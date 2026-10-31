import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { execute, query } from '@/lib/db';
import { errorResponse, parseJson } from '@/lib/http';
import { driverSchema } from '@/lib/validation';
import { driverRows } from '@/lib/data';
export async function GET() {
  try { await requireUser(); return NextResponse.json(await driverRows()); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    await requireUser(); const data = await parseJson(request, driverSchema);
    const result = await execute('INSERT INTO drivers (full_name,license_number,phone,email,license_expires_on,status) VALUES (?,?,?,?,?,?)', [data.full_name,data.license_number,data.phone,data.email,data.license_expires_on,data.status]);
    const [row] = await query<Record<string, unknown>[]>('SELECT * FROM drivers WHERE id=?', [result.insertId]);
    return NextResponse.json(row, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
