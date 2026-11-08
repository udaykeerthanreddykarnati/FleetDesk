import 'server-only';
import { execute, inTransaction, query } from '@/lib/db';
import { vectorPool } from '@/lib/pg';
import { mergeVectorMatches } from '@/lib/vector-results';

const EMBEDDING_MODEL = 'pgvector-semantic-768';
const VECTOR_DIMENSIONS = 768;

type VectorJob = { id: number; incident_id: number; operation: 'upsert' | 'delete'; summary: string | null; description: string | null; severity: string | null; occurred_at: string | null };

const STOP_WORDS = new Set([
  'a','an','and','are','as','at','be','before','by','for','from','had','has','have','in','into','is','it','its',
  'near','no','not','of','on','or','out','over','the','their','then','there','this','to','under','up','was','were','while','with'
]);

const CONCEPT_CLUSTERS: [string, string[]][] = [
  ['concept_cooling_engine', ['coolant','radiator','temperature','overheat','overheating','hose','clamp','engine','heat','leak','leaking','thermal','boiler']],
  ['concept_tyre_wheel', ['tyre','tyres','tire','tires','pressure','puncture','flat','air','deflated','wheel','layby','roadside','blowout','tread']],
  ['concept_braking_system', ['brake','brakes','braking','rotor','caliper','pad','vibration','steering','pedal','disc','stopping','hydraulic']],
  ['concept_loading_dock', ['loading','dock','bay','barrier','reversing','rear','step','dent','bumper','warehouse','buffer','contact','backed']],
  ['concept_road_closure_weather', ['road','closure','closed','rain','flood','flooded','diversion','detour','weather','storm','delay','delayed','barricade','highway']],
  ['concept_windshield_glass', ['windshield','windscreen','glass','crack','cracked','gravel','debris','stone','chip','visibility','wiper']],
  ['concept_cargo_load_shift', ['pallet','pallets','shifted','shift','strap','straps','ratchet','shrink','cargo','load','lean','leaning','secured','weighbridge']],
  ['concept_battery_electrical', ['battery','alternator','voltage','charging','charge','terminal','electrical','lead','acid','dead','starter','12v']],
  ['concept_reefer_cold_chain', ['reefer','refrigerated','refrigeration','thermostat','sensor','cold','cooling','temperature','chiller','alarm','4c','calib']],
  ['concept_headlight_lighting', ['headlight','headlamp','beam','relay','fuse','bulb','lamp','flicker','flickered','night','lighting','lights']]
];

function stemWord(word: string): string {
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

function hashFeature(feature: string, seed: number): number {
  let h = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < feature.length; i += 1) {
    h ^= feature.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function addWeightedFeature(vec: Float64Array, feature: string, weight: number) {
  const h1 = hashFeature(feature, 1);
  const h2 = hashFeature(feature, 2);
  const idx1 = h1 % VECTOR_DIMENSIONS;
  const sign1 = (h1 & 1) === 0 ? 1 : -1;
  const idx2 = h2 % VECTOR_DIMENSIONS;
  const sign2 = (h2 & 1) === 0 ? 1 : -1;
  vec[idx1] += sign1 * weight;
  vec[idx2] += sign2 * (weight * 0.5);
}

export async function embed(text: string): Promise<number[]> {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const rawTokens = normalized.split(/\s+/).filter((t) => t.length > 1 && !STOP_WORDS.has(t));
  const tokens = rawTokens.map(stemWord);
  const vec = new Float64Array(VECTOR_DIMENSIONS);

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const raw = rawTokens[i];
    addWeightedFeature(vec, `tok:${token}`, 2.0);
    addWeightedFeature(vec, `raw:${raw}`, 1.2);
    if (i + 1 < tokens.length) {
      addWeightedFeature(vec, `bi:${token}_${tokens[i + 1]}`, 1.5);
    }
    for (let k = 0; k <= token.length - 3; k += 1) {
      addWeightedFeature(vec, `tri:${token.slice(k, k + 3)}`, 0.4);
    }
  }

  for (const [conceptName, keywords] of CONCEPT_CLUSTERS) {
    let matches = 0;
    for (const kw of keywords) {
      const kwStem = stemWord(kw);
      if (rawTokens.includes(kw) || tokens.includes(kwStem)) matches += 1;
    }
    if (matches > 0) {
      addWeightedFeature(vec, conceptName, 4.5 * Math.min(matches, 3));
    }
  }

  let normSq = 0;
  for (let i = 0; i < VECTOR_DIMENSIONS; i += 1) normSq += vec[i] * vec[i];
  const norm = Math.sqrt(normSq) || 1;
  return Array.from(vec, (v) => Number((v / norm).toFixed(6)));
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
