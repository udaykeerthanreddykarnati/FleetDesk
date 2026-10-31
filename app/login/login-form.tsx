'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function LoginForm() {
  const router=useRouter(); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data=new FormData(event.currentTarget);
    try {
      const response=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:data.get('email'),password:data.get('password')})});
      const result=await response.json(); if(!response.ok) throw new Error(result.error || 'Unable to sign in.');
      router.replace('/'); router.refresh();
    } catch(cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-4">
    <label className="block space-y-1.5 text-sm font-medium">Email<Input name="email" type="email" autoComplete="username" required maxLength={254} /></label>
    <label className="block space-y-1.5 text-sm font-medium">Password<Input name="password" type="password" autoComplete="current-password" required minLength={8} maxLength={200} /></label>
    {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    <Button className="w-full" disabled={busy}>{busy?'Signing in…':'Sign in'}</Button>
  </form>;
}
