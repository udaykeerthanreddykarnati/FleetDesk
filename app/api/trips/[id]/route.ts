import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { execute, inTransaction, query } from '@/lib/db';
import { errorResponse, HttpError } from '@/lib/http';
import { positiveId } from '@/lib/validation';
import { canTransitionTrip } from '@/lib/rules';
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(); const id = positiveId((await context.params).id); const { status } = await request.json() as { status?: string };
    const [trip] = await query<{ status: string; vehicle_id: number | null; driver_id: number | null }[]>('SELECT status,vehicle_id,driver_id FROM trips WHERE id=?', [id]);
    if (!trip) throw new HttpError('Trip was not found.', 404);
    if (!status || !canTransitionTrip(trip.status,status)) throw new HttpError(`Trip status cannot move from ${trip.status} to ${status || 'empty'}.`, 409);
    await inTransaction(async (connection) => {
      await connection.execute('UPDATE trips SET status=?, actual_start=IF(?=\'in_progress\',CURRENT_TIMESTAMP,actual_start), actual_end=IF(?=\'completed\',CURRENT_TIMESTAMP,actual_end) WHERE id=?', [status,status,status,id]);
      if (status === 'in_progress') await connection.execute("UPDATE shipments s JOIN trip_shipments ts ON ts.shipment_id=s.id SET s.status='in_transit' WHERE ts.trip_id=? AND s.status='assigned'", [id]);
      if (status === 'completed') await connection.execute("UPDATE shipments s JOIN trip_shipments ts ON ts.shipment_id=s.id SET s.status='delivered' WHERE ts.trip_id=? AND s.status IN ('assigned','in_transit')", [id]);
      if (status === 'completed' || status === 'cancelled') {
        if (trip.vehicle_id) await connection.execute("UPDATE vehicles SET status='available' WHERE id=?", [trip.vehicle_id]);
        if (trip.driver_id) await connection.execute("UPDATE drivers SET status='available' WHERE id=?", [trip.driver_id]);
      }
      if (status === 'cancelled' && trip.vehicle_id) {
        await connection.execute("UPDATE shipments s JOIN trip_shipments ts ON ts.shipment_id=s.id SET s.status='pending' WHERE ts.trip_id=? AND s.status='assigned'", [id]);
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { await requireUser(); const id=positiveId((await context.params).id); await execute("DELETE FROM trips WHERE id=? AND status='planned'", [id]); return NextResponse.json({ ok: true }); }
  catch (error) { return errorResponse(error); }
}
