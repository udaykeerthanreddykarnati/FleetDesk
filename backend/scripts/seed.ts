import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from '../lib/db';
import { imageMimeFromBytes } from '../lib/image-validation';
import type { RowDataPacket } from 'mysql2';

function loadSeedImage(relativePath: string) {
  const fullPath = join(process.cwd(), 'public', 'seed-images', relativePath);
  const bytes = readFileSync(fullPath);
  const mime = imageMimeFromBytes(bytes);
  if (!mime) throw new Error(`Invalid seed image signature for ${relativePath}`);
  const filename = relativePath.split('/').pop() || 'seed.jpg';
  return { filename, mime, size: bytes.length, bytes };
}

async function main() {
  const vehicles = [
    ['KA-01-AB-1234','truck','Tata','Prima',2022,12000,58420,'vehicles/v1-tata-prima.jpg','Tata Prima heavy commercial truck'],
    ['KA-03-CD-5678','van','Ashok Leyland','Dost+',2023,1500,22410,'vehicles/v2-ashok-leyland.jpg','Light commercial pickup delivery van'],
    ['MH-12-EF-9012','truck','Eicher','Pro 3015',2021,9000,74350,'vehicles/v3-eicher-truck.jpg','Eicher medium-duty freight truck'],
    ['TN-09-GH-3456','tractor','Mahindra','Blazo X',2020,18000,108200,'vehicles/v4-mahindra-tractor.jpg','Heavy-duty semi-tractor unit'],
    ['KA-05-JK-7890','van','Force','Traveller',2024,2200,9180,'vehicles/v5-force-traveller.jpg','Commercial cargo panel van'],
    ['DL-01-MN-2345','truck','BharatBenz','2823R',2023,16000,41200,'vehicles/v6-bharatbenz.jpg','BharatBenz heavy-duty multi-axle truck'],
    ['GJ-06-PQ-6789','van','Tata','Ace Gold',2024,1000,14850,'vehicles/v7-tata-ace.jpg','Tata Ace last-mile city mini-truck'],
    ['AP-16-RS-4321','tractor','Volvo','FM 420',2022,24000,89300,'vehicles/v8-volvo-fm.jpg','Volvo FM heavy prime mover tractor'],
    ['KL-07-TU-8765','trailer','Schmitz Cargobull','S.KO Cool',2021,20000,63400,'vehicles/v9-schmitz-trailer.jpg','Schmitz Cargobull refrigerated semi-trailer'],
    ['TS-09-VW-1357','truck','Isuzu','N-Series NPR',2023,7500,31900,'vehicles/v10-isuzu-npr.jpg','Isuzu NPR box delivery truck']
  ] as const;
  for (const [registration,type,make,model,year,capacity,odometer] of vehicles) {
    await pool.execute(`INSERT INTO vehicles (registration_number,vehicle_type,make,model,year,capacity_kg,odometer_km,status)
      VALUES (?,?,?,?,?,?,?,'available') ON DUPLICATE KEY UPDATE make=VALUES(make),model=VALUES(model),capacity_kg=VALUES(capacity_kg)`, [registration,type,make,model,year,capacity,odometer]);
  }

  const drivers = [
    ['Aarav Nair','KA-DL-2018-0042','+91 98450 11042','aarav.nair@example.local','2028-03-30'],
    ['Meera Kulkarni','KA-DL-2019-0137','+91 98450 11137','meera.kulkarni@example.local','2027-11-15'],
    ['Rohan Iyer','MH-DL-2017-2291','+91 98220 02291','rohan.iyer@example.local','2029-01-21'],
    ['Sana Sheikh','TN-DL-2020-0884','+91 98400 00884','sana.sheikh@example.local','2028-07-09'],
    ['Vikram Deshmukh','DL-DL-2016-3310','+91 98110 33100','vikram.deshmukh@example.local','2028-09-18'],
    ['Ananya Reddy','TS-DL-2021-4492','+91 98490 44920','ananya.reddy@example.local','2029-05-12'],
    ['Karthik Menon','KL-DL-2019-5581','+91 98470 55810','karthik.menon@example.local','2027-12-04'],
    ['Priya Patel','GJ-DL-2020-6623','+91 98250 66230','priya.patel@example.local','2028-08-25'],
    ['Devendra Rao','AP-DL-2018-7745','+91 98480 77450','devendra.rao@example.local','2029-02-14'],
    ['Neha Sharma','MH-DL-2022-8819','+91 98200 88190','neha.sharma@example.local','2030-01-10']
  ] as const;
  for (const driver of drivers) await pool.execute(`INSERT INTO drivers (full_name,license_number,phone,email,license_expires_on,status) VALUES (?,?,?,?,?,'available')
    ON DUPLICATE KEY UPDATE full_name=VALUES(full_name),phone=VALUES(phone),license_expires_on=VALUES(license_expires_on)`, [...driver]);

  const shipments = [
    ['FL-2026-1001','Aranya Foods','Refrigerated spices and dry goods for three city retail locations.','Bengaluru Distribution Hub','Mysuru Retail Cluster',820,'pending','2026-11-02 17:00:00','shipments/s1-spices.jpg','Bulk spices and dry food consignment'],
    ['FL-2026-1002','Saffron Home','Fragile household ceramics packed in reinforced cartons.','Mangaluru Port Warehouse','Bengaluru Central Depot',640,'pending','2026-10-30 12:00:00','shipments/s2-ceramics-cartons.jpg','Reinforced corrugated cartons for fragile goods'],
    ['FL-2026-1003','Nila Medical','Temperature-controlled medical supplies with monitored handoff.','Bengaluru Cold Store','Hubballi Medical Centre',380,'delivered','2026-10-25 18:30:00','shipments/s3-medical-supplies.jpg','Medical supply kits packed for transit'],
    ['FL-2026-1004','Mango Leaf Textiles','Cotton fabric rolls for seasonal production.','Tiruppur Mill','Chennai Freight Yard',1250,'delayed','2026-10-29 15:00:00','shipments/s4-cotton-textiles.jpg','Woven cotton textile rolls'],
    ['FL-2026-1005','Riverstone Hardware','Industrial fasteners and safety equipment.','Pune Warehouse','Nashik Industrial Estate',2100,'pending','2026-11-01 12:00:00','shipments/s5-industrial-fasteners.jpg','Steel industrial fasteners and bolts'],
    ['FL-2026-1006','Deccan Electronics','Palletized server racks and networking hardware in anti-static wrap.','Hyderabad Tech Park','Bengaluru Data Centre',1450,'in_transit','2026-11-03 14:00:00','shipments/s6-server-hardware.jpg','Wooden logistics pallet for electronics hardware'],
    ['FL-2026-1007','Kaveri Agro','Bulk organic coffee bean sacks stacked on wooden pallets.','Chikkamagaluru Estate','Kochi Export Terminal',1900,'pending','2026-11-04 09:30:00','shipments/s7-coffee-sacks.jpg','Roasted and raw coffee bean shipment'],
    ['FL-2026-1008','Sahyadri Auto Parts','Crated transmission assemblies and machined steel gears.','Chakan Auto Cluster','Chennai Assembly Plant',3400,'in_transit','2026-11-02 20:00:00','shipments/s8-machinery-crates.jpg','Heavy-duty boxed auto parts shipment'],
    ['FL-2026-1009','Malabar Fresh Dairy','Insulated cold-chain crates of pasteurized dairy products.','Coimbatore Dairy Plant','Thrissur Distribution Hub',960,'delivered','2026-10-28 07:00:00','shipments/s9-dairy-crates.jpg','Stacked commercial dairy transport crates'],
    ['FL-2026-1010','Coromandel Solar','Boxed photovoltaic solar panels with shock-indicator labels.','Sriperumbudur Factory','Vijayawada Solar Park',2850,'pending','2026-11-05 16:00:00','shipments/s10-solar-panels.jpg','Photovoltaic solar panel modules']
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

  for (const [registration,,,,,,,imagePath,imageDesc] of vehicles) {
    const id = vehicleId[registration];
    const img = loadSeedImage(imagePath);
    await pool.execute(
      `INSERT INTO vehicle_images (vehicle_id,filename,mime_type,file_size,image_data,description)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE filename=VALUES(filename),mime_type=VALUES(mime_type),file_size=VALUES(file_size),image_data=VALUES(image_data),description=VALUES(description),uploaded_at=CURRENT_TIMESTAMP`,
      [id, img.filename, img.mime, img.size, img.bytes, imageDesc]
    );
  }

  for (const [tracking,,,,,,,,imagePath,imageDesc] of shipments) {
    const id = shipmentId[tracking];
    const img = loadSeedImage(imagePath);
    await pool.execute(
      `INSERT INTO shipment_images (shipment_id,filename,mime_type,file_size,image_data,description)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE filename=VALUES(filename),mime_type=VALUES(mime_type),file_size=VALUES(file_size),image_data=VALUES(image_data),description=VALUES(description),uploaded_at=CURRENT_TIMESTAMP`,
      [id, img.filename, img.mime, img.size, img.bytes, imageDesc]
    );
  }

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
    [vehicleId['KA-01-AB-1234'],driverId['Aarav Nair'],'Coolant temperature warning on highway','The driver noticed a rising coolant temperature warning near Tumakuru. The vehicle was pulled over safely; a hose clamp had loosened and coolant level was low. No injuries or cargo damage.','medium','resolved','2026-10-26 11:45:00','incidents/i1-coolant-radiator.jpg','Radiator cooling unit inspected after temperature warning'],
    [vehicleId['KA-03-CD-5678'],driverId['Meera Kulkarni'],'Minor loading bay contact','While reversing at the Bengaluru depot, the van touched a padded loading-bay barrier at low speed. The rear step has a small dent; no one was injured and the shipment was checked.','low','resolved','2026-10-22 16:20:00','incidents/i2-loading-dock.jpg','Warehouse loading dock bay where low-speed contact occurred'],
    [vehicleId['MH-12-EF-9012'],driverId['Rohan Iyer'],'Tyre pressure loss during route','A gradual loss of air in the left rear tyre was detected during a scheduled stop. The driver used the safe lay-by and called roadside support; the tyre was replaced.','medium','investigating','2026-10-24 08:50:00','incidents/i3-flat-tyre.jpg','Roadside tyre puncture repair and replacement'],
    [vehicleId['TN-09-GH-3456'],driverId['Sana Sheikh'],'Unexpected road closure and delay','A road closure following heavy rain required a diversion. The shipment remained secured, but the estimated arrival moved by about two hours.','low','open','2026-10-27 07:30:00','incidents/i4-road-closure.jpg','Flooded highway and road closure signage'],
    [vehicleId['KA-05-JK-7890'],driverId['Meera Kulkarni'],'Brake vibration report','The driver reported steering vibration under braking and returned the van to the depot for inspection before departure. No shipment was loaded.','high','investigating','2026-10-27 09:10:00','incidents/i5-disc-brake.jpg','Disc brake rotor and caliper inspection at depot'],
    [vehicleId['DL-01-MN-2345'],driverId['Vikram Deshmukh'],'Cracked windshield from road debris','Loose gravel kicked up on the highway caused a star crack on the passenger-side windshield. Visibility remained clear and the glass was scheduled for replacement at the hub.','medium','resolved','2026-10-21 14:10:00','incidents/i6-cracked-windshield.jpg','Cracked commercial truck windshield glass'],
    [vehicleId['AP-16-RS-4321'],driverId['Ananya Reddy'],'Shifted pallet load in cargo box','Hard braking for a stray animal caused two shrink-wrapped pallets to lean against the side rail. The driver stopped at a weighbridge and re-tensioned all tie-down straps.','medium','resolved','2026-10-23 17:40:00','incidents/i7-cargo-straps.jpg','Semi-trailer cargo bay inspected after load shift'],
    [vehicleId['GJ-06-PQ-6789'],driverId['Priya Patel'],'Alternator battery charging fault','Dashboard battery voltage warning illuminated during city deliveries. Roadside technician verified a worn alternator terminal lead and installed a freshly charged battery.','high','investigating','2026-10-25 10:15:00','incidents/i8-battery-fault.jpg','Vehicle lead-acid battery and charging terminals'],
    [vehicleId['KL-07-TU-8765'],driverId['Karthik Menon'],'Reefer unit thermostat sensor alarm','The refrigerated trailer control panel triggered a return-air temperature sensor fault code. Secondary sensor maintained the cold chain at 4°C until depot calibration.','high','resolved','2026-10-28 06:20:00','incidents/i9-reefer-trailer.jpg','Thermo King trailer refrigeration unit inspected'],
    [vehicleId['TS-09-VW-1357'],driverId['Devendra Rao'],'Headlight relay failure on night route','Left low-beam headlamp flickered out during pre-dawn dispatch check. A corroded relay and fuse were replaced using the onboard spare kit before departure.','low','resolved','2026-10-28 19:50:00','incidents/i10-headlight-lamp.jpg','Headlamp assembly inspected after relay replacement']
  ] as const;
  for (const [vehicle,driver,summary,description,severity,status,date,imagePath,imageDesc] of incidents) {
    const [existing] = await pool.query<({ id:number } & RowDataPacket)[]>('SELECT id FROM incidents WHERE summary=? AND occurred_at=? LIMIT 1', [summary,date]);
    let incidentRowId = existing[0]?.id;
    if (!incidentRowId) {
      const [result] = await pool.execute<{ insertId:number } & import('mysql2').ResultSetHeader>('INSERT INTO incidents (vehicle_id,driver_id,summary,description,severity,incident_status,occurred_at) VALUES (?,?,?,?,?,?,?)', [vehicle,driver,summary,description,severity,status,date]);
      incidentRowId = result.insertId;
      await pool.execute("INSERT INTO incident_vector_jobs (incident_id,operation,summary,description,severity,occurred_at) VALUES (?,'upsert',?,?,?,?)", [incidentRowId,summary,description,severity,date]);
    }
    const img = loadSeedImage(imagePath);
    await pool.execute(
      `INSERT INTO incident_images (incident_id,filename,mime_type,file_size,image_data,description)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE filename=VALUES(filename),mime_type=VALUES(mime_type),file_size=VALUES(file_size),image_data=VALUES(image_data),description=VALUES(description),uploaded_at=CURRENT_TIMESTAMP`,
      [incidentRowId, img.filename, img.mime, img.size, img.bytes, imageDesc]
    );
  }
  console.log('Seeded 10 vehicles, 10 drivers, 10 shipments, 10 incidents, and 30 real MySQL MEDIUMBLOB images.');
}
main().catch((error) => { console.error(error); process.exitCode=1; }).finally(() => pool.end());
