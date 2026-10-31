import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { errorResponse, parseJson } from '@/lib/http';
import { searchSchema } from '@/lib/validation';
import { similarIncidents, syncPendingVectorJobs } from '@/lib/vector';
export async function POST(request: Request) {
  try {
    await requireUser(); const { query, limit } = await parseJson(request, searchSchema);
    const sync = await syncPendingVectorJobs(100);
    const results = await similarIncidents(query, limit);
    return NextResponse.json({ results, sync });
  } catch (error) { return errorResponse(error); }
}
