import { currentUser } from '@/lib/auth';
import { driverRows } from '@/lib/data';
import { ResourceManager, type FormField, type TableColumn } from '@/frontend/components/resource-manager';
export const dynamic='force-dynamic';
const fields:FormField[]=[
  {name:'full_name',label:'Driver name'}, {name:'license_number',label:'License number'}, {name:'phone',label:'Phone'},
  {name:'email',label:'Email',type:'email',required:false}, {name:'license_expires_on',label:'License expiry',type:'date'},
  {name:'status',label:'Availability',type:'select',defaultValue:'available',options:['available','on_trip','on_leave','inactive'].map((value)=>({value,label:value.replace('_',' ')}))}
];
const columns:TableColumn[]=[{key:'full_name',label:'Driver'},{key:'license_number',label:'License'},{key:'phone',label:'Phone'},{key:'email',label:'Email'},{key:'license_expires_on',label:'License expiry'},{key:'status',label:'Availability'}];
export default async function DriversPage(){const [rows,user]=await Promise.all([driverRows(),currentUser()]);return <ResourceManager title="Drivers" description="Manage driver contact details, license validity, and availability." endpoint="/api/drivers" fields={fields} columns={columns} rows={rows} status={{field:'status',options:['available','on_trip','on_leave','inactive'].map((value)=>({value,label:value.replace('_',' ')}))}} isAdmin={user?.role==='admin'}/>;}
