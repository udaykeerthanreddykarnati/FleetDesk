import Link from 'next/link';
import { AlertTriangle, BarChart3, CircleDollarSign, Home, Package, Route, Search, Settings, Truck, Users, Wrench } from 'lucide-react';
import Providers from '@/frontend/components/providers';
import { NavItem } from '@/frontend/components/nav-item';
import { UserMenu } from '@/frontend/components/user';
import { requirePageUser } from '@/lib/auth';

const navigation = [
  { href:'/', label:'Dashboard', icon:Home },
  { href:'/vehicles', label:'Vehicles', icon:Truck },
  { href:'/drivers', label:'Drivers', icon:Users },
  { href:'/shipments', label:'Shipments', icon:Package },
  { href:'/trips', label:'Trips & assignments', icon:Route },
  { href:'/incidents', label:'Incidents', icon:AlertTriangle },
  { href:'/similar-incidents', label:'Vector search (pgvector)', icon:Search },
  { href:'/reports', label:'Reports', icon:BarChart3 }
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return <Providers><div className="min-h-screen bg-slate-50 text-slate-900 md:flex">
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
      <Link href="/" className="flex h-16 items-center gap-3 border-b border-slate-100 px-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-700 text-white"><Truck className="h-5 w-5" /></span>
        <span><strong className="block text-sm">FleetDesk</strong><small className="text-xs text-slate-500">Fleet & logistics</small></span>
      </Link>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {navigation.map(({href,label,icon:Icon}) => <NavItem key={href} href={href} label={label}><Icon className="h-4 w-4" /></NavItem>)}
        {user.role === 'admin' && <div className="mt-6 border-t border-slate-100 pt-4"><p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Administration</p><NavItem href="/users" label="User management"><Settings className="h-4 w-4" /></NavItem></div>}
      </nav>
      <div className="border-t border-slate-100 px-5 py-4 text-xs text-slate-500">Local operations workspace</div>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-700 text-white md:hidden"><Truck className="h-5 w-5" /></span><div><p className="text-sm font-semibold">Fleet and Logistics Management</p><p className="text-xs text-slate-500">Dispatch, deliveries, and fleet health</p></div></div>
          <UserMenu user={user} />
        </div>
        <nav className="mt-3 flex gap-1 overflow-x-auto pb-1 md:hidden">
          {navigation.map(({href,label,icon:Icon}) => <NavItem key={href} href={href} label={label}><Icon className="h-4 w-4" /></NavItem>)}
          {user.role === 'admin' && <NavItem href="/users" label="Users"><Settings className="h-4 w-4" /></NavItem>}
        </nav>
      </header>
      <main className="mx-auto max-w-[1600px] p-4 md:p-8">{children}</main>
    </div>
  </div></Providers>;
}
