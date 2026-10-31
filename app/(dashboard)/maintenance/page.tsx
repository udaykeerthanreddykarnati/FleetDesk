import { currentUser } from '@/lib/auth';
import { maintenanceRows } from '@/lib/data';
import { query } from '@/lib/db';
import { ResourceManager, type FormField, type TableColumn } from '../resource-manager';
export const dynamic='force-dynamic';
const columns:TableColumn[]=[{key:'service_date',label:'Service date'},{key:'registration_number',label:'Vehicle'},{key:'service_type',label:'Service'},{key:'notes',label:'Notes'},{key:'cost',label:'Cost ₹'},{key:'odometer_km',label:'Odometer km'}];
export default async function MaintenancePage(){
  const [rows,user,vehicles]=await Promise.all([maintenanceRows(),currentUser(),query<{id:number;registration_number:string}[]>('SELECT id,registration_number FROM vehicles ORDER BY registration_number')]);
  const fields:FormField[]=[{name:'vehicle_id',label:'Vehicle',type:'select',options:vehicles.map((row)=>({value:row.id,label:row.registration_number}))},{name:'service_type',label:'Service type'},{name:'service_date',label:'Service date',type:'date'},{name:'cost',label:'Cost ₹',type:'number',step:'0.01'},{name:'odometer_km',label:'Odometer km',type:'number',required:false},{name:'notes',label:'Work notes',type:'textarea',required:false}];
  return <ResourceManager title="Maintenance" description="Log inspections and service costs. Saving a service marks the vehicle unavailable for dispatch." endpoint="/api/maintenance" fields={fields} columns={columns} rows={rows} isAdmin={user?.role==='admin'}/>;
}
