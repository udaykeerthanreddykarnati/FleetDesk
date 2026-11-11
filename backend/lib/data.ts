import 'server-only';
import { query } from '@/lib/db';

export async function dashboardData() {
  const [[metrics], shipmentStatuses, recentIncidents, monthlySpend] = await Promise.all([
    query<Record<string, number>[]>('SELECT * FROM v_fleet_dashboard'),
    query<{ status: string; total: number }[]>(
      'SELECT status, COUNT(*) AS total FROM shipments GROUP BY status ORDER BY status'
    ),
    query<{ id: number; summary: string; severity: string; incident_status: string; occurred_at: Date; vehicle: string | null }[]>(
      `SELECT i.id,i.summary,i.severity,i.incident_status,i.occurred_at,v.registration_number AS vehicle
       FROM incidents i LEFT JOIN vehicles v ON v.id=i.vehicle_id
       ORDER BY i.occurred_at DESC LIMIT 6`
    ),
    query<{ category: string; amount: number }[]>(
      `SELECT category, COALESCE(SUM(amount),0) AS amount FROM expenses
       WHERE incurred_at >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY) GROUP BY category ORDER BY category`
    )
  ]);
  return { metrics: metrics ?? {}, shipmentStatuses, recentIncidents, monthlySpend };
}

export async function vehicleRows() {
  return query<Record<string, unknown>[]>(
    `SELECT v.id,v.registration_number,v.vehicle_type,v.make,v.model,v.year,v.capacity_kg,v.odometer_km,v.status,v.created_at,
      (SELECT COUNT(*) FROM vehicle_images im WHERE im.vehicle_id=v.id) AS has_image
     FROM vehicles v ORDER BY v.registration_number`
  );
}

export async function driverRows() {
  return query<Record<string, unknown>[]>(
    `SELECT id,full_name,license_number,phone,email,license_expires_on,status,created_at FROM drivers ORDER BY full_name`
  );
}

export async function shipmentRows(search = '') {
  if (search.trim()) {
    return query<Record<string, unknown>[]>(
      `SELECT s.id,s.tracking_number,s.customer_name,s.description,s.origin,s.destination,s.weight_kg,s.status,s.expected_delivery,s.delivered_at,s.created_at,
        (SELECT COUNT(*) FROM shipment_images im WHERE im.shipment_id=s.id) AS has_image
       FROM shipments s WHERE MATCH(s.description,s.customer_name,s.origin,s.destination) AGAINST (? IN NATURAL LANGUAGE MODE)
       ORDER BY s.created_at DESC LIMIT 100`, [search.trim()]
    );
  }
  return query<Record<string, unknown>[]>(
    `SELECT s.id,s.tracking_number,s.customer_name,s.description,s.origin,s.destination,s.weight_kg,s.status,s.expected_delivery,s.delivered_at,s.created_at,
      (SELECT COUNT(*) FROM shipment_images im WHERE im.shipment_id=s.id) AS has_image
     FROM shipments s ORDER BY s.created_at DESC LIMIT 100`
  );
}

export async function tripRows() {
  return query<Record<string, unknown>[]>(
    `SELECT t.id,t.trip_code,t.status,t.start_location,t.end_location,t.planned_start,t.actual_start,t.actual_end,
      v.registration_number, d.full_name AS driver_name, COUNT(ts.shipment_id) AS shipment_count,
      COALESCE(SUM(s.weight_kg),0) AS cargo_kg
     FROM trips t LEFT JOIN vehicles v ON v.id=t.vehicle_id LEFT JOIN drivers d ON d.id=t.driver_id
     LEFT JOIN trip_shipments ts ON ts.trip_id=t.id LEFT JOIN shipments s ON s.id=ts.shipment_id
     GROUP BY t.id ORDER BY t.planned_start DESC LIMIT 100`
  );
}

export async function maintenanceRows() {
  return query<Record<string, unknown>[]>(
    `SELECT m.id,m.service_type,m.notes,m.service_date,m.cost,m.odometer_km,v.registration_number
     FROM maintenance_records m JOIN vehicles v ON v.id=m.vehicle_id ORDER BY m.service_date DESC LIMIT 100`
  );
}

export async function expenseRows() {
  return query<Record<string, unknown>[]>(
    `SELECT e.id,e.category,e.vendor,e.description,e.amount,e.quantity,e.unit,e.incurred_at,v.registration_number,t.trip_code
     FROM expenses e LEFT JOIN vehicles v ON v.id=e.vehicle_id LEFT JOIN trips t ON t.id=e.trip_id
     ORDER BY e.incurred_at DESC LIMIT 100`
  );
}

export async function incidentRows() {
  return query<Record<string, unknown>[]>(
    `SELECT i.id,i.summary,i.description,i.severity,i.incident_status,i.occurred_at,i.embedding_status,i.embedding_error,
      v.registration_number,d.full_name AS driver_name,
      (SELECT COUNT(*) FROM incident_images im WHERE im.incident_id=i.id) AS has_image
     FROM incidents i LEFT JOIN vehicles v ON v.id=i.vehicle_id LEFT JOIN drivers d ON d.id=i.driver_id
     ORDER BY i.occurred_at DESC LIMIT 100`
  );
}

export async function reportData() {
  const [monthly, vehicleCosts, delayedShipments, incidentText, statusChains] = await Promise.all([
    query<{ month: string; category: string; expense_count: number; total_amount: number }[]>(
      `SELECT * FROM v_monthly_expense_totals ORDER BY month DESC, category LIMIT 36`
    ),
    query<Record<string, unknown>[]>(
      `SELECT id,registration_number,vehicle_type,maintenance_total,expense_total,
        RANK() OVER (ORDER BY (maintenance_total + expense_total) DESC) AS cost_rank
       FROM (
         SELECT v.id,v.registration_number,v.vehicle_type,
           COALESCE(m.maintenance_total,0) AS maintenance_total,
           fn_vehicle_expense_total(v.id) AS expense_total
         FROM vehicles v LEFT JOIN (
           SELECT vehicle_id,SUM(cost) AS maintenance_total FROM maintenance_records GROUP BY vehicle_id
         ) m ON m.vehicle_id=v.id
       ) vehicle_totals
       ORDER BY cost_rank,registration_number`
    ),
    query<Record<string, unknown>[]>(
      `SELECT s.id,s.tracking_number,s.customer_name,s.origin,s.destination,s.expected_delivery,s.status
       FROM shipments s WHERE s.status IN ('delayed','in_transit') AND s.expected_delivery < CURRENT_TIMESTAMP
         AND EXISTS (SELECT 1 FROM trip_shipments ts JOIN trips t ON t.id=ts.trip_id WHERE ts.shipment_id=s.id AND t.status IN ('assigned','in_progress'))
       ORDER BY s.expected_delivery LIMIT 100`
    ),
    query<Record<string, unknown>[]>(
      `SELECT i.id,i.summary,i.severity,i.embedding_status,
        COUNT(im.incident_id) AS has_image
       FROM incidents i LEFT JOIN incident_images im ON im.incident_id=i.id
       GROUP BY i.id ORDER BY i.occurred_at DESC LIMIT 20`
    ),
    query<Record<string, unknown>[]>(
      `WITH RECURSIVE status_chain AS (
         SELECT h.id, h.shipment_id, s.tracking_number, h.old_status, h.new_status, h.changed_at,
                1 AS step_no, CAST(h.new_status AS CHAR(200)) AS transition_path
         FROM shipment_status_history h
         JOIN shipments s ON s.id = h.shipment_id
         WHERE h.old_status IS NULL
         UNION ALL
         SELECT next_h.id, next_h.shipment_id, sc.tracking_number, next_h.old_status, next_h.new_status, next_h.changed_at,
                sc.step_no + 1, CONCAT(sc.transition_path, ' -> ', next_h.new_status)
         FROM shipment_status_history next_h
         JOIN status_chain sc ON next_h.shipment_id = sc.shipment_id
           AND next_h.old_status = sc.new_status
           AND next_h.id > sc.id
         WHERE sc.step_no < 10
       )
       SELECT id, shipment_id, tracking_number, step_no, transition_path, changed_at
       FROM status_chain
       ORDER BY shipment_id, step_no
       LIMIT 30`
    )
  ]);
  return { monthly, vehicleCosts, delayedShipments, incidentText, statusChains };
}
