import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
import { syncPendingVectorJobs, vectorHealth } from '@/lib/vector';
export async function POST() {
  try { await requireUser(); const sync = await syncPendingVectorJobs(200); return NextResponse.json({ sync, health: await vectorHealth() }); }
  catch (error) { return errorResponse(error); }
}
