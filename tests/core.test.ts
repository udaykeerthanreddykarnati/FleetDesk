import { describe,it,expect } from 'vitest';
import { driverSchema, incidentSchema, shipmentSchema, tripSchema, vehicleSchema } from '../backend/lib/validation';
import { hashPassword, verifyPassword } from '../backend/lib/password';
import { imageMimeFromBytes, MAX_IMAGE_BYTES, safeImageFilename } from '../backend/lib/image-validation';
import { canTransitionShipment, canTransitionTrip } from '../backend/lib/rules';
import { mergeVectorMatches } from '../backend/lib/vector-results';
import { toMysqlUtcDateTime } from '../backend/lib/mysql-date';

describe('fleet data validation',()=>{
  it('normalizes vehicle registration and rejects invalid capacities',()=>{
    const vehicle=vehicleSchema.parse({registration_number:'ka-01-ab-1234',vehicle_type:'truck',make:'Tata',model:'Prima',year:2024,capacity_kg:8000,odometer_km:0});
    expect(vehicle.registration_number).toBe('KA-01-AB-1234');
    expect(()=>vehicleSchema.parse({registration_number:'bad',vehicle_type:'boat',make:'X',model:'Y',year:2024,capacity_kg:0})).toThrow();
  });
  it('validates driver licenses, shipment weights, and trip shipment IDs',()=>{
    expect(driverSchema.safeParse({full_name:'Asha Driver',license_number:'KA-DL-82',phone:'12345678',license_expires_on:'2028-01-01'}).success).toBe(true);
    expect(shipmentSchema.safeParse({tracking_number:'FL-1',customer_name:'Store',description:'Box',origin:'A',destination:'B',weight_kg:0.01}).success).toBe(true);
    expect(shipmentSchema.safeParse({tracking_number:'FL-2',customer_name:'Store',description:'Box',origin:'A',destination:'B',weight_kg:0}).success).toBe(false);
    expect(tripSchema.parse({trip_code:'trip-1',start_location:'A',end_location:'B',planned_start:'2026-10-29T10:00:00.000Z',shipment_ids:['4','5']}).shipment_ids).toEqual([4,5]);
  });
  it('requires useful incident descriptions',()=>{
    expect(incidentSchema.safeParse({summary:'Incident',description:'A detailed brake warning occurred at a stop.',severity:'high',occurred_at:'2026-10-28T10:00:00.000Z'}).success).toBe(true);
    expect(incidentSchema.safeParse({summary:'',description:'',severity:'urgent',occurred_at:'bad'}).success).toBe(false);
  });
});

describe('authentication and role rules',()=>{
  it('stores a salted scrypt hash and rejects a wrong password',async()=>{
    const stored=await hashPassword('correct-horse-battery-staple');
    expect(stored).not.toContain('correct-horse');
    expect(await verifyPassword('correct-horse-battery-staple',stored)).toBe(true);
    expect(await verifyPassword('wrong-password',stored)).toBe(false);
  });
  it('rejects illegal shipment and trip status transitions',()=>{
    expect(canTransitionShipment('pending','assigned')).toBe(true);
    expect(canTransitionShipment('pending','delivered')).toBe(false);
    expect(canTransitionShipment('delivered','pending')).toBe(false);
    expect(canTransitionTrip('assigned','in_progress')).toBe(true);
    expect(canTransitionTrip('planned','completed')).toBe(false);
  });
});

describe('MySQL date persistence',()=>{
  it('converts ISO timestamps into timezone-free UTC DATETIME values',()=>{
    expect(toMysqlUtcDateTime('2026-10-29T17:19:39.910Z')).toBe('2026-10-29 17:19:39');
    expect(toMysqlUtcDateTime('2026-10-29T22:49:39+05:30')).toBe('2026-10-29 17:19:39');
    expect(()=>toMysqlUtcDateTime('not-a-date')).toThrow();
  });
});

describe('binary image validation and vector search result handling',()=>{
  it('detects actual raster image signatures and rejects file-name or MIME spoofing',()=>{
    const png=Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
    expect(imageMimeFromBytes(png)).toBe('image/png');
    expect(imageMimeFromBytes(Buffer.from('<svg onload=alert(1)>'))).toBe(null);
    expect(safeImageFilename('../../unsafe name.png')).toBe('unsafe_name.png');
    expect(MAX_IMAGE_BYTES).toBe(5*1024*1024);
  });
  it('returns no matches when pgvector has no rows and never links orphaned vectors',()=>{
    expect(mergeVectorMatches([],[])).toEqual([]);
    expect(mergeVectorMatches([{incident_id:999,distance:0.1}],[])).toEqual([]);
    const results=mergeVectorMatches([{incident_id:'4',distance:0.2}],[{id:4,summary:'Tyre issue',severity:'medium',incident_status:'open',occurred_at:'2026-10-28'}]);
    expect(results[0].similarity).toBeCloseTo(0.8);
  });
});
