import { currentUser } from '@/lib/auth';
import { expenseRows } from '@/lib/data';
import { query } from '@/lib/db';
import { ResourceManager, type FormField, type TableColumn } from '@/frontend/components/resource-manager';
export const dynamic='force-dynamic';
const columns:TableColumn[]=[{key:'incurred_at',label:'Date'},{key:'category',label:'Category'},{key:'vendor',label:'Vendor'},{key:'registration_number',label:'Vehicle'},{key:'trip_code',label:'Trip'},{key:'description',label:'Description'},{key:'quantity',label:'Quantity'},{key:'amount',label:'Amount ₹'}];
export default async function ExpensesPage(){
  const [rows,user,vehicles,trips]=await Promise.all([expenseRows(),currentUser(),query<{id:number;registration_number:string}[]>('SELECT id,registration_number FROM vehicles ORDER BY registration_number'),query<{id:number;trip_code:string}[]>('SELECT id,trip_code FROM trips ORDER BY planned_start DESC LIMIT 100')]);
  const fields:FormField[]=[{name:'category',label:'Category',type:'select',options:['fuel','toll','repair','other'].map((value)=>({value,label:value}))},{name:'vendor',label:'Vendor'},{name:'amount',label:'Amount ₹',type:'number',step:'0.01'},{name:'incurred_at',label:'Date and time',type:'datetime-local'},{name:'vehicle_id',label:'Vehicle (optional)',type:'select',required:false,options:vehicles.map((row)=>({value:row.id,label:row.registration_number}))},{name:'trip_id',label:'Trip (optional)',type:'select',required:false,options:trips.map((row)=>({value:row.id,label:row.trip_code}))},{name:'quantity',label:'Quantity (optional)',type:'number',required:false,step:'0.01'},{name:'unit',label:'Unit (optional)',required:false,placeholder:'L'},{name:'description',label:'Notes',type:'textarea',required:false}];
  return <ResourceManager title="Fuel & expenses" description="Record fuel, toll, repair, and other operating costs; reports aggregate these real expense rows." endpoint="/api/expenses" fields={fields} columns={columns} rows={rows} isAdmin={user?.role==='admin'}/>;
}
