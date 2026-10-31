import { requirePageAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { UsersManager } from './users-manager';
export const dynamic='force-dynamic';
export default async function UsersPage(){await requirePageAdmin();const rows=await query<{id:number;full_name:string;email:string;role:'admin'|'operations';is_active:boolean|number;created_at:string}[]>('SELECT id,full_name,email,role,is_active,created_at FROM users ORDER BY full_name');return <UsersManager rows={rows}/>;}
