import { currentUser } from '@/lib/auth';
import { incidentRows } from '@/lib/data';
import { query } from '@/lib/db';
import { ResourceManager, type FormField, type TableColumn } from '../resource-manager';
import { SimilarIncidentSearch, VectorSyncButton } from '../similar-incidents';
export const dynamic='force-dynamic';
const columns:TableColumn[]=[{key:'summary',label:'Incident'},{key:'severity',label:'Severity'},{key:'incident_status',label:'Status'},{key:'registration_number',label:'Vehicle'},{key:'driver_name',label:'Driver'},{key:'occurred_at',label:'Occurred'},{key:'embedding_status',label:'Vector sync'}];
export default async function IncidentsPage(){
  const [rows,user,vehicles,drivers,trips]=await Promise.all([
    incidentRows(),currentUser(),query<{id:number;registration_number:string}[]>('SELECT id,registration_number FROM vehicles ORDER BY registration_number'),
    query<{id:number;full_name:string}[]>('SELECT id,full_name FROM drivers ORDER BY full_name'),
    query<{id:number;trip_code:string}[]>('SELECT id,trip_code FROM trips ORDER BY planned_start DESC LIMIT 100')
  ]);
  const fields:FormField[]=[{name:'summary',label:'Short summary'},{name:'description',label:'Incident description',type:'textarea'},{name:'severity',label:'Severity',type:'select',options:['low','medium','high','critical'].map((value)=>({value,label:value}))},{name:'occurred_at',label:'Occurred at',type:'datetime-local'},{name:'incident_status',label:'Resolution status',type:'select',defaultValue:'open',options:['open','investigating','resolved'].map((value)=>({value,label:value}))},{name:'vehicle_id',label:'Vehicle (optional)',type:'select',required:false,options:vehicles.map((row)=>({value:row.id,label:row.registration_number}))},{name:'driver_id',label:'Driver (optional)',type:'select',required:false,options:drivers.map((row)=>({value:row.id,label:row.full_name}))},{name:'trip_id',label:'Trip (optional)',type:'select',required:false,options:trips.map((row)=>({value:row.id,label:row.trip_code}))}];
  return <div className="space-y-7"><ResourceManager title="Incidents" description="Record fleet incidents with operational links and image evidence. Each new or updated description is queued for vector synchronization." endpoint="/api/incidents" fields={fields} columns={columns} rows={rows} status={{field:'incident_status',payloadField:'incident_status',options:['open','investigating','resolved'].map((value)=>({value,label:value}))}} isAdmin={user?.role==='admin'} imageEntity="incidents"/><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Incident vector index</h2><p className="text-sm text-slate-500">MySQL keeps the records; pgvector stores searchable text and embeddings.</p></div><VectorSyncButton/></div><SimilarIncidentSearch/></div>;
}
