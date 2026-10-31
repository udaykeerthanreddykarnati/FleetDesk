import { NextResponse } from 'next/server';
import { requireAdmin, requireUser } from '@/lib/auth';
import { inTransaction } from '@/lib/db';
import { errorResponse } from '@/lib/http';
import { incidentSchema, positiveId } from '@/lib/validation';
import { syncPendingVectorJobs } from '@/lib/vector';
import { toMysqlUtcDateTime } from '@/lib/mysql-date';
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(); const id = positiveId((await context.params).id);
    const data = incidentSchema.partial().parse(await request.json()); const fields = Object.entries(data);
    if (!fields.length) return NextResponse.json({ error: 'Provide at least one field to update.' }, { status: 400 });
    await inTransaction(async (connection) => {
      const [lockedRows] = await connection.execute('SELECT id FROM incidents WHERE id=? FOR UPDATE', [id]);
      const rows = lockedRows as unknown as { id:number }[];
      if (!rows[0]) throw new Error('Incident not found.');
      await connection.execute(`UPDATE incidents SET ${fields.map(([key]) => `\`${key}\`=?`).join(',')} WHERE id=?`, [...fields.map(([key,value]) => key === 'occurred_at' ? toMysqlUtcDateTime(value as string) : value),id]);
      const [updatedRows] = await connection.execute('SELECT summary,description,severity,occurred_at FROM incidents WHERE id=?', [id]);
      const updated = (updatedRows as unknown as { summary:string; description:string; severity:string; occurred_at:string }[])[0];
      await connection.execute("INSERT INTO incident_vector_jobs (incident_id,operation,summary,description,severity,occurred_at) VALUES (?,'upsert',?,?,?,?)", [id,updated.summary,updated.description,updated.severity,updated.occurred_at]);
      await connection.execute("UPDATE incidents SET embedding_status='pending',embedding_error=NULL WHERE id=?", [id]);
    });
    return NextResponse.json({ ok: true, vector_sync: await syncPendingVectorJobs(20) });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(); const id = positiveId((await context.params).id);
    await inTransaction(async (connection) => {
      await connection.execute("INSERT INTO incident_vector_jobs (incident_id,operation) VALUES (?,'delete')", [id]);
      await connection.execute('DELETE FROM incidents WHERE id=?', [id]);
    });
    return NextResponse.json({ vector_sync: await syncPendingVectorJobs(20) });
  } catch (error) { return errorResponse(error); }
}
