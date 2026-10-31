import { NextResponse } from 'next/server';
import { signInWithPassword } from '@/lib/auth';
import { errorResponse, parseJson } from '@/lib/http';
import { loginSchema } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const data = await parseJson(request, loginSchema);
    if (!(await signInWithPassword(data.email, data.password))) {
      return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
