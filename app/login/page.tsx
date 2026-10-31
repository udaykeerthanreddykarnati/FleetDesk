import { redirect } from 'next/navigation';
import { Truck } from 'lucide-react';
import { currentUser } from '@/lib/auth';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  if (await currentUser()) redirect('/');
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-7 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-700 text-white"><Truck className="h-6 w-6" /></span><div><p className="text-lg font-bold">FleetDesk</p><p className="text-sm text-slate-500">Sign in to your local workspace</p></div></div>
      <LoginForm />
      <p className="mt-6 text-xs leading-5 text-slate-500">Your password is verified on this server. The browser receives only a secure, HTTP-only session cookie.</p>
    </section>
  </main>;
}
