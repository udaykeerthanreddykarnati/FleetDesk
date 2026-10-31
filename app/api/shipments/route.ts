import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { execute, query } from '@/lib/db';
import { errorResponse, parseJson, HttpError } from '@/lib/http';
import { shipmentSchema } from '@/lib/validation';
import { shipmentRows } from '@/lib/data';
import { canTransitionShipment } from '@/lib/rules';
import { toMysqlUtcDateTime } from '@/lib/mysql-date';
export async function GET(request: NextRequest) {
  try { await requireUser(); return NextResponse.json(await shipmentRows(request.nextUrl.searchParams.get('q') || '')); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    await requireUser(); const data = await parseJson(request, shipmentSchema);
    const result = await execute('INSERT INTO shipments (tracking_number,customer_name,description,origin,destination,weight_kg,status,expected_delivery) VALUES (?,?,?,?,?,?,?,?)', [data.tracking_number,data.customer_name,data.description,data.origin,data.destination,data.weight_kg,data.status,data.expected_delivery ? toMysqlUtcDateTime(data.expected_delivery) : null]);
    const [row] = await query<Record<string, unknown>[]>('SELECT * FROM shipments WHERE id=?', [result.insertId]);
    return NextResponse.json(row, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request) {
  try {
    await requireUser(); const body = await request.json();
    const id = Number(body.id); const status = String(body.status || '');
    if (!Number.isSafeInteger(id) || id < 1 || !['pending','assigned','in_transit','delivered','delayed','cancelled'].includes(status)) throw new HttpError('Choose a valid shipment and status.');
    const [shipment] = await query<{ id: number; status: string }[]>('SELECT id,status FROM shipments WHERE id=?', [id]);
    if (!shipment) throw new HttpError('Shipment was not found.', 404);
    if (!canTransitionShipment(shipment.status,status)) throw new HttpError(`Shipment status cannot move from ${shipment.status} to ${status}.`, 409);
    await execute('UPDATE shipments SET status=? WHERE id=?', [status,id]);
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
