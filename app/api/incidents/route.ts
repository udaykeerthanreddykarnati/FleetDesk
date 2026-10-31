import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { inTransaction } from '@/lib/db';
import { errorResponse, parseJson } from '@/lib/http';
import { incidentSchema } from '@/lib/validation';
import { incidentRows } from '@/lib/data';
import { syncPendingVectorJobs } from '@/lib/vector';
import { toMysqlUtcDateTime } from '@/lib/mysql-date';
export async function GET() {
  try { await requireUser(); return NextResponse.json(await incidentRows()); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    await requireUser(); const data = await parseJson(request, incidentSchema);
    const id = await inTransaction(async (connection) => {
      const [result] = await connection.execute<{ insertId: number } & import('mysql2').ResultSetHeader>(
        'INSERT INTO incidents (vehicle_id,driver_id,trip_id,summary,description,severity,incident_status,occurred_at) VALUES (?,?,?,?,?,?,?,?)',
        [data.vehicle_id ?? null,data.driver_id ?? null,data.trip_id ?? null,data.summary,data.description,data.severity,data.incident_status,toMysqlUtcDateTime(data.occurred_at)]
      );
      await connection.execute("INSERT INTO incident_vector_jobs (incident_id,operation,summary,description,severity,occurred_at) VALUES (?,'upsert',?,?,?,?)", [result.insertId,data.summary,data.description,data.severity,toMysqlUtcDateTime(data.occurred_at)]);
      return result.insertId;
    });
    const vector_sync = await syncPendingVectorJobs(20);
    return NextResponse.json({ id, vector_sync }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
