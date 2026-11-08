'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export type FieldOption={value:string|number;label:string};
export type FormField={name:string;label:string;type?:'text'|'email'|'number'|'date'|'datetime-local'|'select'|'textarea'|'id-list';options?:FieldOption[];placeholder?:string;defaultValue?:string|number;required?:boolean;step?:string;help?:string};
export type TableColumn={key:string;label:string};
type Props={title:string;description:string;endpoint:string;fields:FormField[];columns:TableColumn[];rows:Record<string,unknown>[];status?:{field:string;options:FieldOption[];endpoint?:string;payloadField?:string};isAdmin:boolean;imageEntity?:'vehicles'|'shipments'|'incidents';emptyMessage?:string;tripAssignment?:{vehicles:FieldOption[];drivers:FieldOption[]}};

function display(value:unknown) {
  if (value===null||value===undefined||value==='') return '—';
  if (value instanceof Date) return value.toISOString().replace('T',' ').slice(0,19);
  if (typeof value==='boolean') return value?'Yes':'No';
  return String(value).replaceAll('_',' ');
}
function fieldValue(field:FormField, value:FormDataEntryValue|null) {
  const raw=String(value??'').trim();
  if (field.type==='number') return raw===''?null:Number(raw);
  if (field.type==='datetime-local') return raw?new Date(raw).toISOString():null;
  if (field.type==='id-list') return raw?raw.split(',').map((part)=>Number(part.trim())).filter((id)=>Number.isSafeInteger(id)&&id>0):[];
  return raw===''?null:raw;
}

export function ResourceManager({title,description,endpoint,fields,columns,rows,status,isAdmin,imageEntity,emptyMessage='No records have been added yet.',tripAssignment}:Props) {
  const router=useRouter(); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [notice,setNotice]=useState(''); const [filter,setFilter]=useState('');
  const shown=useMemo(()=>{const term=filter.toLowerCase().trim();return term?rows.filter((row)=>Object.values(row).some((value)=>String(value??'').toLowerCase().includes(term))):rows;},[filter,rows]);
  async function send(url:string,method:string,body?:unknown) {
    const response=await fetch(url,{method,headers:body instanceof FormData?undefined:{'content-type':'application/json'},body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body)});
    const result=await response.json().catch(()=>({})); if(!response.ok) throw new Error(result.error||'The request could not be completed.'); return result;
  }
  async function create(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement=event.currentTarget;setBusy(true); setError('');setNotice(''); const form=new FormData(formElement); const payload=Object.fromEntries(fields.map((field)=>[field.name,fieldValue(field,form.get(field.name))]));
    try { await send(endpoint,'POST',payload);formElement.reset();setNotice('Record saved.');router.refresh(); }
    catch(cause){setError(cause instanceof Error?cause.message:'Unable to save this record.');}
    finally{setBusy(false);}
  }
  async function changeStatus(row:Record<string,unknown>, next:string) {
    if (!status) return; setError('');setNotice('');
    try { await send(status.endpoint||`${endpoint}/${row.id}`,'PATCH',status.endpoint?{id:row.id,status:next}:{[status.payloadField||'status']:next}); setNotice('Status updated.');router.refresh(); }
    catch(cause){setError(cause instanceof Error?cause.message:'Unable to update status.');}
  }
  async function remove(row:Record<string,unknown>) {
    if (!window.confirm(`Delete record #${row.id}? This cannot be undone.`)) return; setError('');
    try { await send(`${endpoint}/${row.id}`,'DELETE');setNotice('Record deleted.');router.refresh(); }
    catch(cause){setError(cause instanceof Error?cause.message:'Unable to delete this record.');}
  }
  return <div className="space-y-5">
    <div><p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">Operations</p><h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1><p className="mt-2 text-sm text-slate-500">{description}</p></div>
    <Card><CardHeader><CardTitle className="text-lg">Add a record</CardTitle><CardDescription>Enter the required details. The server validates every field before saving.</CardDescription></CardHeader><CardContent>
      <form onSubmit={create} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map((field)=><label key={field.name} className={`block space-y-1.5 text-sm font-medium ${field.type==='textarea'?'sm:col-span-2 xl:col-span-3':''}`}>
          <span>{field.label}</span>
          {field.type==='textarea'?<textarea name={field.name} required={field.required!==false} maxLength={5000} placeholder={field.placeholder} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />:
          field.type==='select'?<select name={field.name} required={field.required!==false} defaultValue={String(field.defaultValue??'')} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{field.required===false&&<option value="">None</option>}{field.options?.map((option)=><option key={`${option.value}`} value={option.value}>{option.label}</option>)}</select>:
          <Input name={field.name} type={field.type==='id-list'?'text':field.type||'text'} required={field.required!==false} min={field.type==='number'?'0':undefined} step={field.step} defaultValue={field.defaultValue} placeholder={field.placeholder} />}
          {field.help&&<span className="block text-xs font-normal text-slate-500">{field.help}</span>}
        </label>)}
        <div className="flex items-end"><Button disabled={busy} className="w-full sm:w-auto">{busy?'Saving…':'Save record'}</Button></div>
      </form>
      {error&&<p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
    </CardContent></Card>
    {tripAssignment&&<Card><CardHeader><CardTitle className="text-lg">Assign a planned trip</CardTitle><CardDescription>Assignment is handled in a MySQL transaction and locks the selected vehicle and driver.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
      {rows.filter((row)=>row.status==='planned').map((trip)=><TripAssignment key={String(trip.id)} trip={trip} vehicles={tripAssignment.vehicles} drivers={tripAssignment.drivers} onError={setError} onDone={()=>{setNotice('Trip assignment saved.');router.refresh();}} />)}
      {!rows.some((row)=>row.status==='planned')&&<p className="text-sm text-slate-500">No planned trips are waiting for assignment.</p>}
    </CardContent></Card>}
    <Card><CardHeader className="flex-row items-center justify-between gap-4"><div><CardTitle className="text-lg">Records</CardTitle><CardDescription>{shown.length} shown · {rows.length} in MySQL</CardDescription></div><label className="relative w-full max-w-xs"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><Input value={filter} onChange={(event)=>setFilter(event.target.value)} placeholder="Filter these records" className="pl-9" aria-label="Filter records" /></label></CardHeader><CardContent className="px-0 sm:px-6">
      {shown.length===0?<p className="px-6 py-10 text-center text-sm text-slate-500">{filter?'No records match that filter.':emptyMessage}</p>:<div className="overflow-x-auto"><Table><TableHeader><TableRow>{columns.map((column)=><TableHead key={column.key} className="whitespace-nowrap">{column.label}</TableHead>)}{imageEntity&&<TableHead>Image in MySQL</TableHead>}{status&&<TableHead>Update status</TableHead>}{tripAssignment&&<TableHead>Assignment</TableHead>}{isAdmin&&<TableHead>Actions</TableHead>}</TableRow></TableHeader><TableBody>
        {shown.map((row)=><TableRow key={String(row.id)} id={title==='Incidents'?`incident-${row.id}`:undefined}>
          {columns.map((column)=><TableCell key={column.key} className="max-w-64 whitespace-nowrap text-sm">{column.key==='status'||column.key==='incident_status'||column.key==='severity'?<span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs capitalize text-slate-700">{display(row[column.key])}</span>:display(row[column.key])}</TableCell>)}
          {imageEntity&&<TableCell><ImageManager entity={imageEntity} id={Number(row.id)} hasImage={Boolean(Number(row.has_image))} onError={setError} onDone={()=>{setNotice('Image bytes saved in MySQL.');router.refresh();}} /></TableCell>}
          {status&&<TableCell><select aria-label={`Set status for record ${row.id}`} value={String(row[status.field]||'')} onChange={(event)=>void changeStatus(row,event.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs capitalize">{status.options.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></TableCell>}
          {tripAssignment&&<TableCell>{row.status==='planned'?<span className="text-xs text-amber-700">Needs vehicle + driver</span>:<span className="text-xs text-emerald-700">{display(row.registration_number)} · {display(row.driver_name)}</span>}</TableCell>}
          {isAdmin&&<TableCell><Button variant="ghost" size="sm" className="text-red-700 hover:text-red-800" onClick={()=>void remove(row)}><Trash2 className="mr-1 h-4 w-4"/>Delete</Button></TableCell>}
        </TableRow>)}
      </TableBody></Table></div>}
    </CardContent></Card>
  </div>;
}

function TripAssignment({trip,vehicles,drivers,onError,onDone}:{trip:Record<string,unknown>;vehicles:FieldOption[];drivers:FieldOption[];onError:(value:string)=>void;onDone:()=>void}) {
  const [busy,setBusy]=useState(false);
  async function assign(formData:FormData) {
    setBusy(true);onError('');
    try { const response=await fetch(`/api/trips/${trip.id}/assign`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({vehicle_id:Number(formData.get('vehicle_id')),driver_id:Number(formData.get('driver_id'))})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Assignment failed.');onDone(); }
    catch(error){onError(error instanceof Error?error.message:'Assignment failed.');}
    finally{setBusy(false);}
  }
  return <form action={assign} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-3"><span className="mr-auto text-sm font-semibold">{String(trip.trip_code)}</span><select name="vehicle_id" required className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"><option value="">Vehicle</option>{vehicles.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</select><select name="driver_id" required className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"><option value="">Driver</option>{drivers.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</select><Button size="sm" disabled={busy}>{busy?'Assigning…':'Assign'}</Button></form>;
}

function ImageManager({entity,id,hasImage,onError,onDone}:{entity:'vehicles'|'shipments'|'incidents';id:number;hasImage:boolean;onError:(value:string)=>void;onDone:()=>void}) {
  const input=useRef<HTMLInputElement>(null);const [busy,setBusy]=useState(false);
  async function upload(file:File) {
    const form=new FormData();form.set('file',file);
    const response=await fetch(`/api/images/${entity}/${id}`,{method:'PUT',body:form});const result=await response.json();if(!response.ok)throw new Error(result.error||'Image upload failed.');onDone();
  }
  async function choose(event:React.ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0];if(!file)return;setBusy(true);onError('');
    try{await upload(file);}catch(error){onError(error instanceof Error?error.message:'Image upload failed.');}finally{setBusy(false);event.target.value='';}
  }
  async function sample() {
    setBusy(true);onError('');
    try{const response=await fetch('/sample-truck.png');if(!response.ok)throw new Error('The local sample image is missing.');const blob=await response.blob();await upload(new File([blob],'sample-truck.png',{type:'image/png'}));}
    catch(error){onError(error instanceof Error?error.message:'Sample upload failed.');}finally{setBusy(false);}
  }
  async function remove() {
    setBusy(true);onError('');
    try{const response=await fetch(`/api/images/${entity}/${id}`,{method:'DELETE'});if(!response.ok)throw new Error('Unable to delete the stored image.');onDone();}
    catch(error){onError(error instanceof Error?error.message:'Unable to delete image.');}finally{setBusy(false);}
  }
  return <div className="flex min-w-48 items-center gap-2">
    {hasImage?<span className="relative block h-10 w-14 overflow-hidden rounded-md border border-slate-200"><Image src={`/api/images/${entity}/${id}`} alt={`${entity} ${id}`} fill sizes="56px" unoptimized className="object-cover"/></span>:<span className="grid h-10 w-14 place-items-center rounded-md bg-slate-100 text-[10px] text-slate-400">No image</span>}
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event)=>void choose(event)} className="sr-only" />
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={()=>input.current?.click()}><Upload className="mr-1 h-3.5 w-3.5"/>{hasImage?'Replace':'Upload'}</Button>
    {entity==='vehicles'&&!hasImage&&<Button type="button" variant="ghost" size="sm" disabled={busy} onClick={()=>void sample()}>Sample</Button>}
    {hasImage&&<Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-500" disabled={busy} onClick={()=>void remove()} aria-label="Delete image"><X className="h-4 w-4"/></Button>}
  </div>;
}
