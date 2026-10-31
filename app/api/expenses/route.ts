import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { execute } from '@/lib/db';
import { errorResponse, parseJson } from '@/lib/http';
import { expenseSchema } from '@/lib/validation';
import { expenseRows } from '@/lib/data';
import { toMysqlUtcDateTime } from '@/lib/mysql-date';
export async function GET() {
  try { await requireUser(); return NextResponse.json(await expenseRows()); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    await requireUser(); const data = await parseJson(request, expenseSchema);
    const result = await execute('INSERT INTO expenses (vehicle_id,trip_id,category,vendor,description,amount,quantity,unit,incurred_at) VALUES (?,?,?,?,?,?,?,?,?)', [data.vehicle_id ?? null,data.trip_id ?? null,data.category,data.vendor,data.description || null,data.amount,data.quantity ?? null,data.unit || null,toMysqlUtcDateTime(data.incurred_at)]);
    return NextResponse.json({ id: result.insertId }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
