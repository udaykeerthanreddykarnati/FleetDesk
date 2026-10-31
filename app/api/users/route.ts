import { NextResponse } from 'next/server';
import { requireAdmin, hashPassword } from '@/lib/auth';
import { execute, query } from '@/lib/db';
import { errorResponse, parseJson } from '@/lib/http';
import { userSchema } from '@/lib/validation';
export async function GET() {
  try { await requireAdmin(); return NextResponse.json(await query<Record<string, unknown>[]>('SELECT id,full_name,email,role,is_active,created_at FROM users ORDER BY full_name')); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    await requireAdmin(); const data = await parseJson(request,userSchema); const password_hash = await hashPassword(data.password);
    const result = await execute('INSERT INTO users (full_name,email,password_hash,role) VALUES (?,?,?,?)', [data.full_name,data.email.toLowerCase(),password_hash,data.role]);
    return NextResponse.json({ id: result.insertId, full_name: data.full_name, email: data.email.toLowerCase(), role: data.role }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
