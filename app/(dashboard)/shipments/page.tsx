import { currentUser } from '@/lib/auth';
import { shipmentRows } from '@/lib/data';
import { ResourceManager, type FormField, type TableColumn } from '@/frontend/components/resource-manager';
import { ShipmentSearch } from '@/frontend/components/shipment-search';
export const dynamic='force-dynamic';
const fields:FormField[]=[
  {name:'tracking_number',label:'Tracking number',placeholder:'FL-2026-1006'}, {name:'customer_name',label:'Customer'},
  {name:'description',label:'Description',type:'textarea'}, {name:'origin',label:'Origin'}, {name:'destination',label:'Destination'},
  {name:'weight_kg',label:'Cargo weight (kg)',type:'number',step:'0.01'},
  {name:'expected_delivery',label:'Expected delivery',type:'datetime-local',required:false},
  {name:'status',label:'Initial status',type:'select',defaultValue:'pending',options:['pending','assigned','in_transit','delivered','delayed','cancelled'].map((value)=>({value,label:value.replace('_',' ')}))}
];
const columns:TableColumn[]=[{key:'tracking_number',label:'Tracking'},{key:'customer_name',label:'Customer'},{key:'description',label:'Shipment details'},{key:'origin',label:'Origin'},{key:'destination',label:'Destination'},{key:'weight_kg',label:'Weight kg'},{key:'status',label:'Status'},{key:'expected_delivery',label:'Expected delivery'}];
export default async function ShipmentsPage({searchParams}:{searchParams:Promise<{q?:string}>}){const {q=''}=await searchParams;const [rows,user]=await Promise.all([shipmentRows(q),currentUser()]);return <><ShipmentSearch value={q}/><ResourceManager title="Shipments" description="Create consignments, follow delivery status, and use MySQL full-text search across shipment details." endpoint="/api/shipments" fields={fields} columns={columns} rows={rows} status={{field:'status',endpoint:'/api/shipments',options:['pending','assigned','in_transit','delivered','delayed','cancelled'].map((value)=>({value,label:value.replace('_',' ')}))}} isAdmin={user?.role==='admin'} imageEntity="shipments" emptyMessage={q?'No full-text matches. Try a longer description word.':'No shipment records have been added yet.'}/></>;}
