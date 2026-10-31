import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, CircleDollarSign, Package, Route, Truck, Wrench } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboardData } from '@/lib/data';

export const dynamic = 'force-dynamic';
const money = (value: unknown) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(value||0));
const statusColor: Record<string,string> = { pending:'bg-slate-100 text-slate-700', assigned:'bg-blue-50 text-blue-700', in_transit:'bg-amber-50 text-amber-800', delivered:'bg-emerald-50 text-emerald-800', delayed:'bg-rose-50 text-rose-700', cancelled:'bg-slate-100 text-slate-500' };

export default async function DashboardPage() {
  const data = await dashboardData(); const metrics=data.metrics;
  const cards = [
    {label:'Fleet vehicles',value:Number(metrics.total_vehicles||0),hint:`${Number(metrics.available_vehicles||0)} available now`,icon:Truck,href:'/vehicles',color:'text-emerald-700 bg-emerald-50'},
    {label:'Active trips',value:Number(metrics.active_trips||0),hint:'Assigned or in progress',icon:Route,href:'/trips',color:'text-blue-700 bg-blue-50'},
    {label:'Delivered shipments',value:Number(metrics.delivered_shipments||0),hint:'All-time completed',icon:Package,href:'/shipments',color:'text-violet-700 bg-violet-50'},
    {label:'Maintenance spend',value:money(metrics.maintenance_costs),hint:'Recorded to date',icon:Wrench,href:'/maintenance',color:'text-amber-700 bg-amber-50'},
    {label:'Fuel costs',value:money(metrics.fuel_costs),hint:'All recorded fuel expenses',icon:CircleDollarSign,href:'/expenses',color:'text-cyan-700 bg-cyan-50'},
    {label:'Other operating costs',value:money(metrics.other_expenses),hint:'Tolls, repairs, and other',icon:CircleDollarSign,href:'/expenses',color:'text-orange-700 bg-orange-50'}
  ];
  const shipmentTotal=data.shipmentStatuses.reduce((total,row)=>total+Number(row.total),0);
  return <div className="space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">Operations overview</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Fleet dashboard</h1><p className="mt-2 text-sm text-slate-500">Live totals from your local operations database.</p></div><Link href="/reports" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">Open reports <ArrowUpRight className="h-4 w-4" /></Link></div>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(({label,value,hint,icon:Icon,href,color})=><Link href={href} key={label} className="group"><Card className="h-full transition-shadow group-hover:shadow-md"><CardContent className="flex items-start justify-between p-5"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{hint}</p></div><span className={`rounded-xl p-3 ${color}`}><Icon className="h-5 w-5" /></span></CardContent></Card></Link>)}
    </section>
    <section className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
      <Card><CardHeader><CardTitle>Shipments by status</CardTitle><CardDescription>{shipmentTotal} total shipments in MySQL</CardDescription></CardHeader><CardContent className="space-y-3">
        {data.shipmentStatuses.length ? data.shipmentStatuses.map((row)=>{const count=Number(row.total);const pct=shipmentTotal?Math.round(count/shipmentTotal*100):0;return <div key={row.status} className="grid grid-cols-[110px_1fr_40px] items-center gap-3"><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusColor[row.status]||'bg-slate-100 text-slate-700'}`}>{row.status.replace('_',' ')}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{width:`${pct}%`}} /></div><span className="text-right text-sm font-semibold text-slate-700">{count}</span></div>}) : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">No shipment records yet.</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Operating spend · last 30 days</CardTitle><CardDescription>Grouped by expense category</CardDescription></CardHeader><CardContent className="space-y-4">
        {data.monthlySpend.length ? data.monthlySpend.map((row)=><div key={row.category} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0"><span className="text-sm capitalize text-slate-600">{row.category}</span><span className="text-sm font-semibold text-slate-900">{money(row.amount)}</span></div>) : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">No expenses recorded in the last 30 days.</p>}
      </CardContent></Card>
    </section>
    <Card><CardHeader><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600"/><div><CardTitle>Recent incidents</CardTitle><CardDescription>Most recently reported events</CardDescription></div></div></CardHeader><CardContent>
      {data.recentIncidents.length ? <div className="divide-y divide-slate-100">{data.recentIncidents.map((incident)=><Link key={incident.id} href={`/incidents#incident-${incident.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><p className="font-medium text-slate-900">{incident.summary}</p><p className="mt-1 text-xs text-slate-500">{incident.vehicle||'Unassigned vehicle'} · {new Date(incident.occurred_at).toLocaleString()}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs capitalize text-slate-600">{incident.incident_status}</span><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs capitalize text-amber-800">{incident.severity}</span></div></Link>)}</div> : <div className="flex items-center gap-2 rounded-lg border border-dashed p-5 text-sm text-slate-500">No incidents have been recorded.</div>}
    </CardContent></Card>
  </div>;
}
