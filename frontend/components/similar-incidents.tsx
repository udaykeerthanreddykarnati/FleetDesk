'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Match={id:number;summary:string;severity:string;incident_status:string;occurred_at:string;similarity:number};
export function SimilarIncidentSearch(){
  const [results,setResults]=useState<Match[]|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [syncNote,setSyncNote]=useState('');
  async function search(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);const query=String(form.get('query')||'').trim();setBusy(true);setError('');setSyncNote('');setResults(null);
    try{const response=await fetch('/api/incidents/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,limit:8})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Search failed.');setResults(data.results);if(data.sync?.failed)setSyncNote(`${data.sync.failed} incident(s) pending search indexing; existing results shown.`);}
    catch(cause){setError(cause instanceof Error?cause.message:'Search is unavailable.');}
    finally{setBusy(false);}
  }
  return <div className="space-y-4"><Card><CardHeader><CardTitle>Search incident history</CardTitle><CardDescription>Describe an issue or symptom in plain English to find matching incidents and resolutions.</CardDescription></CardHeader><CardContent><form onSubmit={search} className="space-y-3"><label htmlFor="incident-query" className="text-sm font-medium">Incident description</label><textarea id="incident-query" name="query" minLength={8} maxLength={500} required placeholder="For example: vehicle lost coolant during a long highway delivery" className="min-h-28 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"/><div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Searches across all reported mechanical breakdowns and route delays.</p><Button disabled={busy}><Search className="mr-2 h-4 w-4"/>{busy?'Searching…':'Find similar incidents'}</Button></div></form></CardContent></Card>
    {error&&<p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}{syncNote&&<p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">{syncNote}</p>}
    {results&&<Card><CardHeader><CardTitle className="text-lg">Ranked incident matches</CardTitle><CardDescription>Past incidents with the most similar operational and mechanical symptoms.</CardDescription></CardHeader><CardContent>{results.length?<div className="space-y-3">{results.map((match)=><Link key={match.id} href={`/incidents#incident-${match.id}`} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/30"><div><p className="font-semibold text-slate-900">{match.summary}</p><p className="mt-1 text-xs capitalize text-slate-500">{match.severity} severity · {match.incident_status} · {new Date(match.occurred_at).toLocaleString()}</p></div><div className="min-w-24 text-right"><p className="text-lg font-bold text-emerald-700">{(match.similarity*100).toFixed(1)}%</p><p className="text-[11px] uppercase tracking-wide text-slate-400">match relevance</p></div></Link>)}</div>:<p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">No similar incidents found. Try describing the issue with different terms.</p>}</CardContent></Card>}
  </div>;
}

export function VectorSyncButton(){const[busy,setBusy]=useState(false);const[note,setNote]=useState('');const[error,setError]=useState('');
  async function run(){setBusy(true);setNote('');setError('');try{const response=await fetch('/api/incidents/sync',{method:'POST'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Sync retry failed.');setNote(`Synced ${data.sync.synced}; failed ${data.sync.failed}; remaining ${data.sync.remaining}.`);}catch(cause){setError(cause instanceof Error?cause.message:'Sync failed.');}finally{setBusy(false);}}
  return <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy} onClick={()=>void run()}>{busy?'Updating index…':'Refresh search index'}</Button>{note&&<span role="status" className="text-sm text-emerald-800">{note}</span>}{error&&<span role="alert" className="text-sm text-red-700">{error}</span>}</div>;
}
