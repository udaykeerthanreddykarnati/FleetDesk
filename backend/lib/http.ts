import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AccessError } from '@/lib/auth';

export class HttpError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function errorResponse(error: unknown) {
  if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: 'Please check the submitted fields.', details: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })) }, { status: 400 });
  const message = error instanceof Error ? error.message : '';
  if (/foreign key|duplicate entry|cannot delete|constraint fails/i.test(message)) {
    return NextResponse.json({ error: 'This record conflicts with related fleet records. Review its assignments and try again.' }, { status: 409 });
  }
  if (typeof error === 'object' && error && 'code' in error && (error as { code: string }).code === 'ER_SIGNAL_EXCEPTION') {
    return NextResponse.json({ error: message || 'The requested database operation violates a fleet rule.' }, { status: 409 });
  }
  console.error('API request failed:', error);
  return NextResponse.json({ error: 'The request could not be completed. Check the local database configuration.' }, { status: 500 });
}

export function jsonError(error: unknown) { return errorResponse(error); }

export async function parseJson<T>(request: Request, schema: { parse: (value: unknown) => T }): Promise<T> {
  return schema.parse(await request.json());
}
