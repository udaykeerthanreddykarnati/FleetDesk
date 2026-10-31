import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { dashboardData } from '@/lib/data';
import { errorResponse } from '@/lib/http';
export async function GET() {
  try { await requireUser(); return NextResponse.json(await dashboardData()); }
  catch (error) { return errorResponse(error); }
}
