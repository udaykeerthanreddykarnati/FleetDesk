import { NextResponse } from 'next/server';
import { requireAdmin, requireUser } from '@/lib/auth';
import { execute } from '@/lib/db';
import { errorResponse } from '@/lib/http';
import { positiveId, vehicleSchema } from '@/lib/validation';
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(); const id = positiveId((await context.params).id);
    const data = vehicleSchema.partial().parse(await request.json());
    const entries = Object.entries(data);
    if (!entries.length) return NextResponse.json({ error: 'Provide at least one field to update.' }, { status: 400 });
    await execute(`UPDATE vehicles SET ${entries.map(([key]) => `\`${key}\`=?`).join(',')} WHERE id=?`, [...entries.map(([, value]) => value), id]);
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); await execute('DELETE FROM vehicles WHERE id=?', [positiveId((await context.params).id)]); return NextResponse.json({ ok: true }); }
  catch (error) { return errorResponse(error); }
}
