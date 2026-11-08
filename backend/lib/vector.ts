import 'server-only';
import { execute, inTransaction, query } from '@/lib/db';
import { vectorPool } from '@/lib/pg';
import { mergeVectorMatches } from '@/lib/vector-results';

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
const OLLAMA_URL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');

type VectorJob = { id: number; incident_id: number; operation: 'upsert' | 'delete'; summary: string | null; description: string | null; severity: string | null; occurred_at: string | null };

async function embed(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }), cache: 'no-store', signal: AbortSignal.timeout(120000)
  });
  if (!response.ok) throw new Error(`Local embedding model returned HTTP ${response.status}. Run [1mnpm run model:pull[0m and start Ollama.`);
  const payload = await response.json() as { embeddings?: number[][] };
  const vector = payload.embeddings?.[0];
  if (!vector || vector.length !== 768 || vector.some((value) => !Number.isFinite(value))) {
    throw new Error(`Expected a genuine ${EMBEDDING_MODEL} embedding with 768 numeric dimensions.`);
  }
  return vector;
}

async function claimNextJob(): Promise<VectorJob | null> {
  return inTransaction(async (connection) => {
    const [rawRows] = await connection.execute(
      `SELECT j.id,j.incident_id,j.operation,j.summary,j.description,j.severity,j.occurred_at
       FROM incident_vector_jobs j
       WHERE j.state IN ('pending','failed')
         AND NOT EXISTS (
           SELECT 1 FROM incident_vector_jobs older
           WHERE older.incident_id=j.incident_id AND older.id<j.id AND older.state<>'done'
         )
       ORDER BY j.id LIMIT 1 FOR UPDATE SKIP LOCKED`
    );
    const job = (rawRows as unknown as VectorJob[])[0];
    if (!job) return null;
    await connection.execute("UPDATE incident_vector_jobs SET state='processing', attempts=attempts+1 WHERE id=?", [job.id]);
    return job;
  });
}

async function finishJob(job: VectorJob, error?: unknown): Promise<void> {
  const message = error instanceof Error ? error.message.slice(0, 490) : 'Unknown vector synchronization failure';
  if (error) {
    await execute("UPDATE incident_vector_jobs SET state='failed', last_error=?, processed_at=NULL WHERE id=?", [message, job.id]);
    await execute("UPDATE incidents SET embedding_status='failed', embedding_error=? WHERE id=?", [message, job.incident_id]);
  } else {
    await execute("UPDATE incident_vector_jobs SET state='done', last_error=NULL, processed_at=CURRENT_TIMESTAMP WHERE id=?", [job.id]);
    if (job.operation === 'upsert') await execute("UPDATE incidents SET embedding_status='synced', embedding_error=NULL WHERE id=?", [job.incident_id]);
  }
}

export async function syncPendingVectorJobs(maxJobs = 100): Promise<{ synced: number; failed: number; remaining: number }> {
  let synced = 0;
  let failed = 0;
  for (let index = 0; index < maxJobs; index += 1) {
    const job = await claimNextJob();
    if (!job) break;
    try {
      if (job.operation === 'delete') {
        await vectorPool.query('DELETE FROM incident_vectors WHERE incident_id=$1', [job.incident_id]);
      } else {
        const content = `${job.summary}\n${job.description}`;
        const embedding = await embed(content);
        await vectorPool.query(
          `INSERT INTO incident_vectors (incident_id,summary,description,severity,occurred_at,embedding,updated_at)
           VALUES ($1,$2,$3,$4,$5,$6::vector,CURRENT_TIMESTAMP)
           ON CONFLICT (incident_id) DO UPDATE SET summary=EXCLUDED.summary, description=EXCLUDED.description,
             severity=EXCLUDED.severity, occurred_at=EXCLUDED.occurred_at, embedding=EXCLUDED.embedding, updated_at=CURRENT_TIMESTAMP`,
          [job.incident_id, job.summary, job.description, job.severity, job.occurred_at, `[${embedding.join(',')}]`]
        );
      }
      await finishJob(job);
      synced += 1;
    } catch (error) {
      await finishJob(job, error);
      failed += 1;
    }
  }
  const rows = await query<{ pending_count: number }[]>("SELECT COUNT(*) AS pending_count FROM incident_vector_jobs WHERE state IN ('pending','processing','failed')");
  return { synced, failed, remaining: Number(rows[0]?.pending_count || 0) };
}

export async function similarIncidents(text: string, limit = 5) {
  const vector = await embed(text);
  const { rows } = await vectorPool.query<{ incident_id: string; summary: string; description: string; severity: string; occurred_at: Date; distance: number }>(
    `SELECT incident_id,summary,description,severity,occurred_at,(embedding <=> $1::vector) AS distance
     FROM incident_vectors ORDER BY embedding <=> $1::vector LIMIT $2`,
    [`[${vector.join(',')}]`, limit]
  );
  const ids = rows.map((row) => Number(row.incident_id));
  if (ids.length === 0) return [];
  const incidents = await query<{ id: number; incident_status: string; summary: string; severity: string; occurred_at: Date }[]>(
    `SELECT id,incident_status,summary,severity,occurred_at FROM incidents WHERE id IN (${ids.map(() => '?').join(',')})`, ids
  );
  return mergeVectorMatches(rows.map((row)=>({incident_id:row.incident_id,distance:Number(row.distance)})),incidents);
}

export async function vectorHealth() {
  try {
    const result = await vectorPool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM incident_vectors');
    return { postgres: true, model: EMBEDDING_MODEL, indexedIncidents: Number(result.rows[0]?.count || 0) };
  } catch {
    return { postgres: false, model: EMBEDDING_MODEL, indexedIncidents: 0 };
  }
}
