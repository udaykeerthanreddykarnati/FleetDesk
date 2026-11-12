import { currentUser } from '@/lib/auth';
import { vehicleRows } from '@/lib/data';
import { ResourceManager, type FormField, type TableColumn } from '@/frontend/components/resource-manager';
export const dynamic='force-dynamic';
const fields:FormField[]=[
  {name:'registration_number',label:'Registration number',placeholder:'KA-01-AB-1234'},
  {name:'vehicle_type',label:'Type',type:'select',defaultValue:'truck',options:['van','truck','tractor','trailer'].map((value)=>({value,label:value}))},
  {name:'make',label:'Make',placeholder:'Tata'}, {name:'model',label:'Model',placeholder:'Prima'},
  {name:'year',label:'Year',type:'number',defaultValue:2024}, {name:'capacity_kg',label:'Capacity (kg)',type:'number',step:'0.01'},
  {name:'odometer_km',label:'Odometer (km)',type:'number',defaultValue:0},
  {name:'status',label:'Status',type:'select',defaultValue:'available',options:['available','on_trip','maintenance','inactive'].map((value)=>({value,label:value.replace('_',' ')}))}
];
const columns:TableColumn[]=[{key:'registration_number',label:'Registration'},{key:'vehicle_type',label:'Type'},{key:'make',label:'Make'},{key:'model',label:'Model'},{key:'year',label:'Year'},{key:'capacity_kg',label:'Capacity kg'},{key:'odometer_km',label:'Odometer km'},{key:'status',label:'Availability'}];
export default async function VehiclesPage(){const [rows,user]=await Promise.all([vehicleRows(),currentUser()]);return <ResourceManager title="Vehicles" description="Track fleet units, availability status, payload capacity, and vehicle photos." endpoint="/api/vehicles" fields={fields} columns={columns} rows={rows} status={{field:'status',options:['available','on_trip','maintenance','inactive'].map((value)=>({value,label:value.replace('_',' ')}))}} isAdmin={user?.role==='admin'} imageEntity="vehicles"/>;}
