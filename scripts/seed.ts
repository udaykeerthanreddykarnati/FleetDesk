import { pool } from '../lib/db';
import type { RowDataPacket } from 'mysql2';

async function main() {
  const vehicles = [
    ['KA-01-AB-1234','truck','Tata','Prima',2022,12000,58420],
    ['KA-03-CD-5678','van','Ashok Leyland','Dost+',2023,1500,22410],
    ['MH-12-EF-9012','truck','Eicher','Pro 3015',2021,9000,74350],
    ['TN-09-GH-3456','tractor','Mahindra','Blazo X',2020,18000,108200],
    ['KA-05-JK-7890','van','Force','Traveller',2024,2200,9180]
  ] as const;
  for (const [registration,type,make,model,year,capacity,odometer] of vehicles) {
    await pool.execute(`INSERT INTO vehicles (registration_number,vehicle_type,make,model,year,capacity_kg,odometer_km,status)
      VALUES (?,?,?,?,?,?,?,'available') ON DUPLICATE KEY UPDATE make=VALUES(make),model=VALUES(model),capacity_kg=VALUES(capacity_kg)`, [registration,type,make,model,year,capacity,odometer]);
  }
  const drivers = [
    ['Aarav Nair','KA-DL-2018-0042','+91 98450 11042','aarav.nair@example.local','2028-03-30'],
    ['Meera Kulkarni','KA-DL-2019-0137','+91 98450 11137','meera.kulkarni@example.local','2027-11-15'],
    ['Rohan Iyer','MH-DL-2017-2291','+91 98220 02291','rohan.iyer@example.local','2029-01-21'],
    ['Sana Sheikh','TN-DL-2020-0884','+91 98400 00884','sana.sheikh@example.local','2028-07-09']
  ] as const;
  for (const driver of drivers) await pool.execute(`INSERT INTO drivers (full_name,license_number,phone,email,license_expires_on,status) VALUES (?,?,?,?,?,'available')
    ON DUPLICATE KEY UPDATE full_name=VALUES(full_name),phone=VALUES(phone),license_expires_on=VALUES(license_expires_on)`, [...driver]);

  const shipments = [
    ['FL-2026-1001','Aranya Foods','Refrigerated spices and dry goods for three city retail locations.','Bengaluru Distribution Hub','Mysuru Retail Cluster',820,'pending','2026-11-02 17:00:00'],
    ['FL-2026-1002','Saffron Home','Fragile household ceramics packed in reinforced cartons.','Mangaluru Port Warehouse','Bengaluru Central Depot',640,'pending','2026-10-30 12:00:00'],
    ['FL-2026-1003','Nila Medical','Temperature-controlled medical supplies with monitored handoff.','Bengaluru Cold Store','Hubballi Medical Centre',380,'delivered','2026-10-25 18:30:00'],
    ['FL-2026-1004','Mango Leaf Textiles','Cotton fabric rolls for seasonal production.','Tiruppur Mill','Chennai Freight Yard',1250,'delayed','2026-10-29 15:00:00'],
    ['FL-2026-1005','Riverstone Hardware','Industrial fasteners and safety equipment.','Pune Warehouse','Nashik Industrial Estate',2100,'pending','2026-11-01 12:00:00']
  ] as const;
  for (const [tracking,customer,description,origin,destination,weight,status,expected] of shipments) {
    await pool.execute(`INSERT INTO shipments (tracking_number,customer_name,description,origin,destination,weight_kg,status,expected_delivery,delivered_at)
      VALUES (?,?,?,?,?,?,?,?,IF(?='delivered',?,NULL)) ON DUPLICATE KEY UPDATE description=VALUES(description),expected_delivery=VALUES(expected_delivery)`, [tracking,customer,description,origin,destination,weight,status,expected,status,expected]);
  }

  const [vehicleRows] = await pool.query<({ id:number; registration_number:string } & RowDataPacket)[]>('SELECT id,registration_number FROM vehicles');
  const [driverRows] = await pool.query<({ id:number; full_name:string } & RowDataPacket)[]>('SELECT id,full_name FROM drivers');
  const vehicleId = Object.fromEntries(vehicleRows.map((row) => [row.registration_number,row.id]));
  const driverId = Object.fromEntries(driverRows.map((row) => [row.full_name,row.id]));
  const shipmentsByCode = await pool.query<({ id:number; tracking_number:string } & RowDataPacket)[]>('SELECT id,tracking_number FROM shipments');
  const shipmentId = Object.fromEntries(shipmentsByCode[0].map((row) => [row.tracking_number,row.id]));

  const maintenance = [
    [vehicleId['KA-01-AB-1234'],'Quarterly service','Oil, filters, brakes inspected.','2026-08-20',8400,56000],
    [vehicleId['MH-12-EF-9012'],'Tyre replacement','Two rear tyres replaced during scheduled service.','2026-09-14',29600,72100]
  ];
  for (const item of maintenance) await pool.execute('INSERT INTO maintenance_records (vehicle_id,service_type,notes,service_date,cost,odometer_km) SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM maintenance_records WHERE vehicle_id=? AND service_date=? AND service_type=?)', [...item,item[0],item[3],item[1]]);

  const expenses = [
    [vehicleId['KA-01-AB-1234'],'fuel','Bharat Petroleum','Diesel refill at Tumakuru',6250,72.4,'L','2026-10-26 09:10:00'],
    [vehicleId['KA-03-CD-5678'],'toll','FASTag','Bengaluru ring-road tolls',760,null,null,'2026-10-25 18:30:00'],
    [vehicleId['MH-12-EF-9012'],'fuel','Indian Oil','Diesel refill before dispatch',7120,80,'L','2026-10-24 06:20:00'],
    [vehicleId['TN-09-GH-3456'],'repair','Coimbatore Fleet Care','Electrical inspection',3200,null,null,'2026-10-20 14:15:00'],
    [vehicleId['KA-05-JK-7890'],'fuel','Shell','Van fuel stop',2430,28,'L','2026-10-27 08:00:00']
  ];
  for (const item of expenses) await pool.execute('INSERT INTO expenses (vehicle_id,category,vendor,description,amount,quantity,unit,incurred_at) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE vehicle_id=? AND vendor=? AND incurred_at=?)', [...item,item[0],item[2],item[7]]);

  await pool.execute(`INSERT IGNORE INTO trips (trip_code,start_location,end_location,planned_start) VALUES
    ('TRIP-2601','Bengaluru Distribution Hub','Mysuru Retail Cluster','2026-10-29 06:30:00'),
    ('TRIP-2602','Mangaluru Port Warehouse','Bengaluru Central Depot','2026-10-30 05:45:00'),
    ('TRIP-2603','Pune Warehouse','Nashik Industrial Estate','2026-11-01 07:00:00')`);
  const [trips] = await pool.query<({ id:number; trip_code:string; status:string } & RowDataPacket)[]>('SELECT id,trip_code,status FROM trips WHERE trip_code IN (\'TRIP-2601\',\'TRIP-2602\',\'TRIP-2603\')');
  const tripByCode = Object.fromEntries(trips.map((row) => [row.trip_code,row]));
  for (const [tripCode,shipmentCode] of [['TRIP-2601','FL-2026-1001'],['TRIP-2602','FL-2026-1002'],['TRIP-2603','FL-2026-1005']]) {
    await pool.execute('INSERT IGNORE INTO trip_shipments (trip_id,shipment_id) VALUES (?,?)', [tripByCode[tripCode].id,shipmentId[shipmentCode]]);
  }
  if (tripByCode['TRIP-2601'].status === 'planned') {
    await pool.execute('CALL sp_assign_trip(?,?,?)', [tripByCode['TRIP-2601'].id,vehicleId['KA-01-AB-1234'],driverId['Aarav Nair']]);
  }

  const incidents = [
    [vehicleId['KA-01-AB-1234'],driverId['Aarav Nair'],'Coolant temperature warning on highway','The driver noticed a rising coolant temperature warning near Tumakuru. The vehicle was pulled over safely; a hose clamp had loosened and coolant level was low. No injuries or cargo damage.','medium','resolved','2026-10-26 11:45:00'],
    [vehicleId['KA-03-CD-5678'],driverId['Meera Kulkarni'],'Minor loading bay contact','While reversing at the Bengaluru depot, the van touched a padded loading-bay barrier at low speed. The rear step has a small dent; no one was injured and the shipment was checked.','low','resolved','2026-10-22 16:20:00'],
    [vehicleId['MH-12-EF-9012'],driverId['Rohan Iyer'],'Tyre pressure loss during route','A gradual loss of air in the left rear tyre was detected during a scheduled stop. The driver used the safe lay-by and called roadside support; the tyre was replaced.','medium','investigating','2026-10-24 08:50:00'],
    [vehicleId['TN-09-GH-3456'],driverId['Sana Sheikh'],'Unexpected road closure and delay','A road closure following heavy rain required a diversion. The shipment remained secured, but the estimated arrival moved by about two hours.','low','open','2026-10-27 07:30:00'],
    [vehicleId['KA-05-JK-7890'],driverId['Meera Kulkarni'],'Brake vibration report','The driver reported steering vibration under braking and returned the van to the depot for inspection before departure. No shipment was loaded.','high','investigating','2026-10-27 09:10:00']
  ] as const;
  for (const [vehicle,driver,summary,description,severity,status,date] of incidents) {
    const [existing] = await pool.query<({ id:number } & RowDataPacket)[]>('SELECT id FROM incidents WHERE summary=? AND occurred_at=? LIMIT 1', [summary,date]);
    if (!existing[0]) {
      const [result] = await pool.execute<{ insertId:number } & import('mysql2').ResultSetHeader>('INSERT INTO incidents (vehicle_id,driver_id,summary,description,severity,incident_status,occurred_at) VALUES (?,?,?,?,?,?,?)', [vehicle,driver,summary,description,severity,status,date]);
      await pool.execute("INSERT INTO incident_vector_jobs (incident_id,operation,summary,description,severity,occurred_at) VALUES (?,'upsert',?,?,?,?)", [result.insertId,summary,description,severity,date]);
    }
  }
  console.log('Seeded fictional fleet, driver, shipment, trip, maintenance, expense, and incident data.');
}
main().catch((error) => { console.error(error); process.exitCode=1; }).finally(() => pool.end());
