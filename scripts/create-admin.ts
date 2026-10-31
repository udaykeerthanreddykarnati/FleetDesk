import { pool } from '../lib/db';
import { hashPassword } from '../lib/password';
import type { RowDataPacket } from 'mysql2';

async function main() {
  const flags = new Map<string,string>();
  for (let index=2; index<process.argv.length; index+=2) flags.set(process.argv[index],process.argv[index+1] || '');
  const fullName = flags.get('--name')?.trim(); const email = flags.get('--email')?.trim().toLowerCase();
  const password = process.env.FLEET_ADMIN_PASSWORD;
  if (!fullName || !email || !password || password.length<12) {
    throw new Error('Usage: FLEET_ADMIN_PASSWORD="12+ chars" npm run admin:create -- --name "Fleet Admin" --email admin@example.local');
  }
  const [rows] = await pool.query<({ total: number } & RowDataPacket)[]>('SELECT COUNT(*) AS total FROM users');
  if (Number(rows[0]?.total)>0) throw new Error('An account already exists. Use the Admin > Users screen to add accounts.');
  const digest = await hashPassword(password);
  await pool.execute('INSERT INTO users (full_name,email,password_hash,role) VALUES (?,?,?,\'admin\')', [fullName,email,digest]);
  console.log(`Created the first local Admin account for ${email}.`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode=1; }).finally(() => pool.end());
