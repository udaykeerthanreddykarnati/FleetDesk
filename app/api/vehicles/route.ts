import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { execute, query } from '@/lib/db';
import { errorResponse, parseJson } from '@/lib/http';
import { vehicleSchema } from '@/lib/validation';
import { vehicleRows } from '@/lib/data';
export async function GET() {
  try { await requireUser(); return NextResponse.json(await vehicleRows()); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    await requireUser();
    const data = await parseJson(request, vehicleSchema);
    const result = await execute('INSERT INTO vehicles (registration_number,vehicle_type,make,model,year,capacity_kg,odometer_km,status) VALUES (?,?,?,?,?,?,?,?)', [data.registration_number,data.vehicle_type,data.make,data.model,data.year,data.capacity_kg,data.odometer_km,data.status]);
    const [row] = await query<Record<string, unknown>[]>('SELECT * FROM vehicles WHERE id=?', [result.insertId]);
    return NextResponse.json(row, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
