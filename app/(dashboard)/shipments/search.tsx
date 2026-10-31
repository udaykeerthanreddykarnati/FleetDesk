'use client';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
export function ShipmentSearch({value}:{value:string}){return <form action="/shipments" className="mb-4 flex max-w-xl gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><Input name="q" defaultValue={value} placeholder="Search shipment text with MySQL full-text" className="pl-9"/></div><button className="rounded-md bg-slate-900 px-4 text-sm font-medium text-white">Search</button></form>;}
