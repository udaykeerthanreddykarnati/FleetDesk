import 'server-only';
import { createHmac, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { execute, query } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';

export type UserRole = 'admin' | 'operations';
export type AppUser = { id: number; full_name: string; email: string; role: UserRole };

export class AccessError extends Error {
  constructor(message: string, public status = 401) { super(message); }
}

const COOKIE_NAME = 'fleet_session';
const SESSION_HOURS = 12;
function tokenHash(token: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('Set SESSION_SECRET to a random value with at least 32 characters.');
  return createHmac('sha256', secret).update(token).digest();
}

export async function signInWithPassword(email: string, password: string): Promise<boolean> {
  const users = await query<(AppUser & { password_hash: string; is_active: number })[]>(
    'SELECT id, full_name, email, role, password_hash, is_active FROM users WHERE email = ? LIMIT 1', [email.toLowerCase()]
  );
  const user = users[0];
  if (!user || !user.is_active || !(await verifyPassword(password, user.password_hash))) return false;

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  await execute('INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [tokenHash(token), user.id, expiresAt]);
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt
  });
  return true;
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) await execute('DELETE FROM app_sessions WHERE token_hash = ?', [tokenHash(token)]);
  jar.delete(COOKIE_NAME);
}

export async function currentUser(): Promise<AppUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const rows = await query<AppUser[]>(
    `SELECT u.id, u.full_name, u.email, u.role
     FROM app_sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=? AND s.expires_at>CURRENT_TIMESTAMP AND u.is_active=TRUE LIMIT 1`,
    [tokenHash(token)]
  );
  return rows[0] ?? null;
}

export async function requireUser(): Promise<AppUser> {
  const user = await currentUser();
  if (!user) throw new AccessError('Please sign in to continue.', 401);
  return user;
}

export async function requireAdmin(): Promise<AppUser> {
  const user = await requireUser();
  if (user.role !== 'admin') throw new AccessError('Administrator access is required.', 403);
  return user;
}

export async function requirePageUser(): Promise<AppUser> {
  const user = await currentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requirePageAdmin(): Promise<AppUser> {
  const user = await requirePageUser();
  if (user.role !== 'admin') redirect('/');
  return user;
}

export { hashPassword };
