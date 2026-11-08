import { currentUser } from '@/lib/auth';
import { tripRows } from '@/lib/data';
import { query } from '@/lib/db';
import { ResourceManager, type FormField, type TableColumn, type FieldOption } from '@/frontend/components/resource-manager';
export const dynamic='force-dynamic';
const fields:FormField[]=[
  {name:'trip_code',label:'Trip code',placeholder:'TRIP-2604'}, {name:'start_location',label:'Start location'},
  {name:'end_location',label:'End location'}, {name:'planned_start',label:'Planned start',type:'datetime-local'},
  {name:'shipment_ids',label:'Shipment IDs',type:'id-list',required:false,placeholder:'12, 14',help:'Optional. Find the numeric ID in the Shipments table.'}
];
const columns:TableColumn[]=[{key:'trip_code',label:'Trip'},{key:'status',label:'Status'},{key:'start_location',label:'From'},{key:'end_location',label:'To'},{key:'planned_start',label:'Planned start'},{key:'shipment_count',label:'Shipments'},{key:'cargo_kg',label:'Cargo kg'}];
export default async function TripsPage(){
  const [rows,user,vehicles,drivers]=await Promise.all([
    tripRows(),currentUser(),
    query<{id:number;registration_number:string}[]>('SELECT id,registration_number FROM vehicles WHERE status=\'available\' ORDER BY registration_number'),
    query<{id:number;full_name:string}[]>('SELECT id,full_name FROM drivers WHERE status=\'available\' AND license_expires_on>=CURRENT_DATE ORDER BY full_name')
  ]);
  const vehicleOptions:FieldOption[]=vehicles.map((row)=>({value:row.id,label:row.registration_number}));const driverOptions=drivers.map((row)=>({value:row.id,label:row.full_name}));
  return <ResourceManager title="Trips & assignments" description="Plan trips, attach shipments, then assign an available vehicle and licensed driver in one locked MySQL transaction." endpoint="/api/trips" fields={fields} columns={columns} rows={rows} status={{field:'status',options:['planned','assigned','in_progress','completed','cancelled'].map((value)=>({value,label:value.replace('_',' ')}))}} isAdmin={user?.role==='admin'} tripAssignment={{vehicles:vehicleOptions,drivers:driverOptions}}/>;
}
