import { NextResponse } from 'next/server';
import { requireAdmin, hashPassword } from '@/lib/auth';
import { execute, query } from '@/lib/db';
import { errorResponse, HttpError } from '@/lib/http';
import { positiveId } from '@/lib/validation';
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(); const id = positiveId((await context.params).id);
    const body = await request.json() as { full_name?: string; role?: string; is_active?: boolean; password?: string };
    if (id === admin.id && (body.role === 'operations' || body.is_active === false)) throw new HttpError('You cannot remove your own administrator access.', 409);
    const fields: string[] = []; const values: unknown[] = [];
    if (body.full_name !== undefined) { const value=String(body.full_name).trim(); if (value.length<2 || value.length>120) throw new HttpError('Name must have 2 to 120 characters.'); fields.push('full_name=?'); values.push(value); }
    if (body.role !== undefined) { if (!['admin','operations'].includes(body.role)) throw new HttpError('Choose a valid role.'); fields.push('role=?'); values.push(body.role); }
    if (body.is_active !== undefined) { if (typeof body.is_active !== 'boolean') throw new HttpError('Active must be true or false.'); fields.push('is_active=?'); values.push(body.is_active); }
    if (body.password !== undefined) { if (body.password.length<12) throw new HttpError('New password must contain at least 12 characters.'); fields.push('password_hash=?'); values.push(await hashPassword(body.password)); }
    if (!fields.length) throw new HttpError('Provide at least one field to update.');
    await execute(`UPDATE users SET ${fields.join(',')} WHERE id=?`, [...values,id]);
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(); const id=positiveId((await context.params).id);
    if (id===admin.id) throw new HttpError('You cannot delete your own account.', 409);
    const [row] = await query<{ role: string }[]>('SELECT role FROM users WHERE id=?', [id]);
    if (row?.role==='admin') {
      const count = await query<{ total: number }[]>('SELECT COUNT(*) AS total FROM users WHERE role=\'admin\' AND is_active=TRUE');
      if (Number(count[0]?.total)<=1) throw new HttpError('Keep at least one active administrator.', 409);
    }
    await execute('DELETE FROM users WHERE id=?', [id]); return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
