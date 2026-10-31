import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { pool } from '@/lib/db';
import { errorResponse, parseJson } from '@/lib/http';
import { positiveId, tripAssignmentSchema } from '@/lib/validation';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(); const tripId = positiveId((await context.params).id);
    const data = await parseJson(request, tripAssignmentSchema);
    await pool.execute('CALL sp_assign_trip(?,?,?)', [tripId,data.vehicle_id,data.driver_id]);
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
