import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../lib/db';

const base=process.env.API_BASE_URL||'http://127.0.0.1:3000';
const adminEmail=process.env.TEST_ADMIN_EMAIL;
const adminPassword=process.env.TEST_ADMIN_PASSWORD;
if(!adminEmail||!adminPassword)throw new Error('Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to an Admin account before integration tests.');

let adminCookie='';let operationsCookie='';let runKey='';let vehicleId=0;let driverId=0;let shipmentId=0;let tripId=0;let retryTripId=0;let incidentId=0;let operationsUserId=0;
async function api(path:string,init:RequestInit={},cookie=adminCookie){return fetch(new URL(path,base),{...init,headers:{...(init.body instanceof FormData?{}:{'content-type':'application/json'}),...(cookie?{cookie}:{}),...init.headers}});}
async function login(email:string,password:string){const response=await fetch(new URL('/api/login',base),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});const data=await response.json();const cookie=response.headers.getSetCookie()[0]?.split(';')[0]||'';return{response,data,cookie};}
function body(value:unknown){return JSON.stringify(value);}

describe('local FleetDesk API integration',()=>{
  beforeAll(async()=>{
    runKey=Date.now().toString().slice(-8);
    const start=await fetch(new URL('/login',base));expect(start.status).toBe(200);
    const invalid=await login(adminEmail,'this-password-is-not-valid');expect(invalid.response.status).toBe(401);
    const authenticated=await login(adminEmail,adminPassword);expect(authenticated.response.status).toBe(200);adminCookie=authenticated.cookie;expect(adminCookie).toContain('fleet_session=');
  });

  it('enforces roles and exercises operational CRUD, transactions, BLOB storage, and vector search',async()=>{
    const health=await api('/api/vehicles');expect(health.status).toBe(200);
    const opsEmail='ops-'+runKey+'@example.local';
    const userResponse=await api('/api/users',{method:'POST',body:body({full_name:'Test Operations',email:opsEmail,password:'temporary-test-pass-642',role:'operations'})});
    expect(userResponse.status).toBe(201);operationsUserId=(await userResponse.json()).id;
    const ops=await login(opsEmail,'temporary-test-pass-642');expect(ops.response.status).toBe(200);operationsCookie=ops.cookie;
    expect((await api('/api/users',{},operationsCookie)).status).toBe(403);
    expect((await api('/api/vehicles',{},operationsCookie)).status).toBe(200);
    expect((await api('/api/users',{method:'POST',body:body({full_name:'No Access',email:'deny-'+runKey+'@example.local',password:'temporary-test-pass-642',role:'operations'})},operationsCookie)).status).toBe(403);

    const vehicle=await api('/api/vehicles',{method:'POST',body:body({registration_number:'TST-'+runKey,vehicle_type:'truck',make:'Test',model:'Local',year:2024,capacity_kg:8000,odometer_km:100,status:'available'})});
    expect(vehicle.status).toBe(201);vehicleId=(await vehicle.json()).id;
    expect((await api('/api/vehicles/'+vehicleId,{method:'PATCH',body:body({odometer_km:125})})).status).toBe(200);
    const invalidVehicle=await api('/api/vehicles',{method:'POST',body:body({registration_number:'BAD-'+runKey,vehicle_type:'truck',make:'Test',model:'Bad',year:2024,capacity_kg:-5})});expect(invalidVehicle.status).toBe(400);

    const driver=await api('/api/drivers',{method:'POST',body:body({full_name:'Test Driver '+runKey,license_number:'TST-DL-'+runKey,phone:'+91 90000 00001',license_expires_on:'2030-01-01',status:'available'})});
    expect(driver.status).toBe(201);driverId=(await driver.json()).id;
    expect((await api('/api/drivers')).status).toBe(200);

    const shipment=await api('/api/shipments',{method:'POST',body:body({tracking_number:'TST-S-'+runKey,customer_name:'Test Depot',description:'Test cargo to validate delivery workflow and assignment.',origin:'Local Origin',destination:'Local Destination',weight_kg:400,status:'pending'})});
    expect(shipment.status).toBe(201);shipmentId=(await shipment.json()).id;
    expect((await api('/api/shipments',{method:'PATCH',body:body({id:shipmentId,status:'delivered'})})).status).toBe(409);
    const search=await api('/api/shipments?q='+encodeURIComponent('validate delivery'));expect(search.status).toBe(200);expect((await search.json()).some((row:{id:number})=>row.id===shipmentId)).toBe(true);

    const trip=await api('/api/trips',{method:'POST',body:body({trip_code:'TST-T-'+runKey,start_location:'Local Origin',end_location:'Local Destination',planned_start:new Date(Date.now()+86400000).toISOString(),shipment_ids:[shipmentId]})});
    expect(trip.status).toBe(201);tripId=(await trip.json()).id;
    const invalidAssignment=await api('/api/trips/'+tripId+'/assign',{method:'POST',body:body({vehicle_id:999999999,driver_id:driverId})});expect(invalidAssignment.status).toBe(409);
    const [tripRows]=await pool.query('SELECT status,vehicle_id,driver_id FROM trips WHERE id=?',[tripId]);const initialTrip=(tripRows as {status:string;vehicle_id:number|null;driver_id:number|null}[])[0];expect(initialTrip.status).toBe('planned');expect(initialTrip.vehicle_id).toBe(null);expect(initialTrip.driver_id).toBe(null);
    expect((await api('/api/trips/'+tripId+'/assign',{method:'POST',body:body({vehicle_id:vehicleId,driver_id:driverId})})).status).toBe(200);
    const [assignedRows]=await pool.query('SELECT status,vehicle_id,driver_id FROM trips WHERE id=?',[tripId]);const assigned=(assignedRows as {status:string;vehicle_id:number;driver_id:number}[])[0];expect(assigned.status).toBe('assigned');expect(Number(assigned.vehicle_id)).toBe(vehicleId);
    const retryTrip=await api('/api/trips',{method:'POST',body:body({trip_code:'TST-R-'+runKey,start_location:'A',end_location:'B',planned_start:new Date(Date.now()+172800000).toISOString(),shipment_ids:[]})});expect(retryTrip.status).toBe(201);retryTripId=(await retryTrip.json()).id;
    expect((await api('/api/trips/'+retryTripId+'/assign',{method:'POST',body:body({vehicle_id:vehicleId,driver_id:driverId})})).status).toBe(409);
    const [retryRows]=await pool.query('SELECT status,vehicle_id,driver_id FROM trips WHERE id=?',[retryTripId]);const rolledBack=(retryRows as {status:string;vehicle_id:number|null;driver_id:number|null}[])[0];expect(rolledBack.status).toBe('planned');expect(rolledBack.vehicle_id).toBe(null);expect(rolledBack.driver_id).toBe(null);
    expect((await api('/api/trips/'+tripId,{method:'PATCH',body:body({status:'in_progress'})})).status).toBe(200);
    let [shipmentRows]=await pool.query('SELECT status FROM shipments WHERE id=?',[shipmentId]);expect((shipmentRows as {status:string}[])[0].status).toBe('in_transit');
    expect((await api('/api/trips/'+tripId,{method:'PATCH',body:body({status:'completed'})})).status).toBe(200);
    [shipmentRows]=await pool.query('SELECT status FROM shipments WHERE id=?',[shipmentId]);expect((shipmentRows as {status:string}[])[0].status).toBe('delivered');

    expect((await api('/api/maintenance',{method:'POST',body:body({vehicle_id:vehicleId,service_type:'Integration inspection',service_date:new Date().toISOString().slice(0,10),cost:1250,odometer_km:130})})).status).toBe(201);
    expect((await api('/api/vehicles/'+vehicleId,{method:'PATCH',body:body({status:'available'})})).status).toBe(200);
    expect((await api('/api/expenses',{method:'POST',body:body({vehicle_id:vehicleId,trip_id:tripId,category:'fuel',vendor:'Test fuel station',description:'Integration test fill',amount:650,quantity:8,unit:'L',incurred_at:new Date().toISOString()})})).status).toBe(201);
    expect((await api('/api/expenses')).status).toBe(200);

    const fakeForm=new FormData();fakeForm.set('file',new File([Buffer.from('<script>not an image</script>')],'fake.png',{type:'image/png'}));
    expect((await api('/api/images/vehicles/'+vehicleId,{method:'POST',body:fakeForm})).status).toBe(400);
    const sample=await fetch(new URL('/sample-truck.png',base));expect(sample.status).toBe(200);const sampleBytes=Buffer.from(await sample.arrayBuffer());
    const imageForm=new FormData();imageForm.set('file',new File([sampleBytes],'route-truck.png',{type:'text/plain'}));
    expect((await api('/api/images/vehicles/'+vehicleId,{method:'POST',body:imageForm})).status).toBe(201);
    const image=await api('/api/images/vehicles/'+vehicleId);expect(image.headers.get('content-type')).toBe('image/png');expect(Buffer.from(await image.arrayBuffer())).toEqual(sampleBytes);
    const [blobRows]=await pool.query('SELECT file_size,image_data FROM vehicle_images WHERE vehicle_id=?',[vehicleId]);const stored=(blobRows as {file_size:number;image_data:Buffer}[])[0];expect(Number(stored.file_size)).toBe(sampleBytes.length);expect(stored.image_data).toEqual(sampleBytes);
    const replacement=new FormData();replacement.set('file',new File([sampleBytes],'replacement.png',{type:'image/png'}));expect((await api('/api/images/vehicles/'+vehicleId,{method:'PUT',body:replacement})).status).toBe(201);
    expect((await api('/api/images/vehicles/'+vehicleId,{method:'DELETE'})).status).toBe(200);expect((await api('/api/images/vehicles/'+vehicleId)).status).toBe(404);

    const incident=await api('/api/incidents',{method:'POST',body:body({vehicle_id:vehicleId,driver_id:driverId,summary:'Test coolant warning '+runKey,description:'Engine coolant temperature increased during a highway delivery, and the driver safely stopped to inspect a leaking hose.',severity:'medium',incident_status:'open',occurred_at:new Date().toISOString()})});
    expect(incident.status).toBe(201);incidentId=(await incident.json()).id;
    const [incidentRows]=await pool.query('SELECT embedding_status FROM incidents WHERE id=?',[incidentId]);expect((incidentRows as {embedding_status:string}[])[0].embedding_status).toBe('synced');
    const vectorSearch=await api('/api/incidents/search',{method:'POST',body:body({query:'The truck had a coolant leak and engine temperature warning on a highway journey.',limit:5})});expect(vectorSearch.status).toBe(200);
    const result=await vectorSearch.json();expect(result.results.some((match:{id:number})=>match.id===incidentId)).toBe(true);expect(result.results[0].similarity).toBeGreaterThan(0);expect(result.results[0].similarity).toBeLessThanOrEqual(1);
    expect((await api('/api/incidents')).status).toBe(200);
    expect((await api('/api/incidents/search',{method:'POST',body:body({query:'short',limit:5})})).status).toBe(400);
    expect((await api('/api/incidents/'+incidentId,{method:'DELETE'})).status).toBe(200);
  },180000);

  afterAll(async()=>{
    try{
      if(operationsCookie)await api('/api/logout',{method:'POST'},operationsCookie);
      if(adminCookie){
        if(incidentId)await api('/api/incidents/'+incidentId,{method:'DELETE'});
        if(retryTripId)await pool.execute('DELETE FROM trips WHERE id=?',[retryTripId]);
        if(tripId)await pool.execute('DELETE FROM trips WHERE id=?',[tripId]);
        if(shipmentId)await pool.execute('DELETE FROM shipments WHERE id=?',[shipmentId]);
        if(vehicleId){await pool.execute('DELETE FROM maintenance_records WHERE vehicle_id=?',[vehicleId]);await pool.execute('DELETE FROM expenses WHERE vehicle_id=?',[vehicleId]);await pool.execute('DELETE FROM vehicles WHERE id=?',[vehicleId]);}
        if(driverId)await pool.execute('DELETE FROM drivers WHERE id=?',[driverId]);
        if(operationsUserId)await api('/api/users/'+operationsUserId,{method:'DELETE'});
        await api('/api/logout',{method:'POST'});
      }
    }catch(error){console.error('Integration cleanup left only uniquely-prefixed test rows:',error);}
    await pool.end();
  });
});
