import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
import { reportData } from '@/lib/data';
export async function GET() {
  try { await requireUser(); return NextResponse.json(await reportData()); }
  catch (error) { return errorResponse(error); }
}
