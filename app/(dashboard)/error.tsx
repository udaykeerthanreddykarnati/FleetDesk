'use client';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
export default function DashboardError({error,reset}:{error:Error & {digest?:string};reset:()=>void}){
  useEffect(()=>{console.error('Dashboard request failed:',error);},[error]);
  return <section className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-semibold">The workspace could not load</h1><p className="mt-2 text-sm text-slate-600">Check that the local MySQL database is running and that .env.local contains the right connection settings.</p><Button className="mt-5" onClick={()=>reset()}>Try again</Button></section>;
}
