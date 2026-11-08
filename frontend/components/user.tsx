'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { AppUser } from '@/lib/auth';

export function UserMenu({ user }: { user: AppUser }) {
  const router = useRouter(); const [busy,setBusy] = useState(false);
  async function logout() { setBusy(true); await fetch('/api/logout',{method:'POST'}); router.replace('/login'); router.refresh(); }
  return <div className="flex items-center gap-3">
    <div className="hidden text-right sm:block"><p className="text-sm font-semibold text-slate-800">{user.full_name}</p><p className="text-xs uppercase tracking-wide text-slate-500">{user.role === 'admin' ? 'Administrator' : 'Operations staff'}</p></div>
    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={logout}>{busy ? 'Signing out…' : 'Sign out'}</Button>
  </div>;
}
