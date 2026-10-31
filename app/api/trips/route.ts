import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { inTransaction } from '@/lib/db';
import { errorResponse, parseJson, HttpError } from '@/lib/http';
import { tripSchema } from '@/lib/validation';
import { tripRows } from '@/lib/data';
import { toMysqlUtcDateTime } from '@/lib/mysql-date';
export async function GET() {
  try { await requireUser(); return NextResponse.json(await tripRows()); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    await requireUser(); const data = await parseJson(request, tripSchema);
    const result = await inTransaction(async (connection) => {
      if (data.shipment_ids.length) {
        const ids = [...new Set(data.shipment_ids)].sort((a,b) => a-b);
        const [shipmentResult] = await connection.execute(`SELECT id,status FROM shipments WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY id FOR UPDATE`, ids);
        const shipments = shipmentResult as unknown as { id:number; status:string }[];
        if (shipments.length !== ids.length || shipments.some((shipment) => !['pending','delayed'].includes(shipment.status))) {
          throw new HttpError('Every selected shipment must exist and be pending or delayed.', 409);
        }
      }
      const [tripResult] = await connection.execute<{ insertId: number } & import('mysql2').ResultSetHeader>(
        'INSERT INTO trips (trip_code,start_location,end_location,planned_start) VALUES (?,?,?,?)',
        [data.trip_code,data.start_location,data.end_location,toMysqlUtcDateTime(data.planned_start)]
      );
      for (const shipmentId of [...new Set(data.shipment_ids)]) {
        await connection.execute('INSERT INTO trip_shipments (trip_id,shipment_id) VALUES (?,?)', [tripResult.insertId,shipmentId]);
      }
      return tripResult.insertId;
    });
    return NextResponse.json({ id: result, status: 'planned' }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
