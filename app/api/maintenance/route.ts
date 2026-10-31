import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { inTransaction } from '@/lib/db';
import { errorResponse, HttpError, parseJson } from '@/lib/http';
import { maintenanceSchema } from '@/lib/validation';
import { maintenanceRows } from '@/lib/data';
export async function GET() {
  try { await requireUser(); return NextResponse.json(await maintenanceRows()); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    await requireUser(); const data = await parseJson(request, maintenanceSchema);
    await inTransaction(async (connection) => {
      const [vehicleResult] = await connection.execute('SELECT status FROM vehicles WHERE id=? FOR UPDATE', [data.vehicle_id]);
      const vehicles = vehicleResult as unknown as { status:string }[];
      if (!vehicles[0]) throw new HttpError('Vehicle was not found.', 404);
      if (vehicles[0].status === 'on_trip') throw new HttpError('A vehicle on a trip cannot be marked for service.', 409);
      await connection.execute('INSERT INTO maintenance_records (vehicle_id,service_type,notes,service_date,cost,odometer_km) VALUES (?,?,?,?,?,?)', [data.vehicle_id,data.service_type,data.notes || null,data.service_date,data.cost,data.odometer_km ?? null]);
      await connection.execute("UPDATE vehicles SET status='maintenance' WHERE id=?", [data.vehicle_id]);
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
