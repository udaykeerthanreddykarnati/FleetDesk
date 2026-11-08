-- FleetDesk MySQL examples. Run against fleet_logistics.
-- Core DDL is maintained in ../backend/sql/mysql/001_schema.sql and routines in
-- ../backend/sql/mysql/002_programmability.sql; do not maintain a second schema here.

-- 0. DDL: CREATE, ALTER, and DROP (safe demo table).
CREATE TABLE IF NOT EXISTS demo_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  note VARCHAR(120) NOT NULL
) ENGINE=InnoDB;

ALTER TABLE demo_audit_log
  ADD COLUMN logged_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  COMMENT = 'Temporary demonstration table for DDL operations';

DROP TABLE IF EXISTS demo_audit_log;

-- 1. INSERT, SELECT, UPDATE, DELETE (wrapped in a transaction for a safe demo).
START TRANSACTION;
INSERT INTO vehicles
  (registration_number, vehicle_type, make, model, year, capacity_kg, odometer_km)
VALUES
  ('SQL-DEMO-01', 'van', 'Demo', 'Cargo', 2024, 1200, 0);

SELECT id, registration_number, vehicle_type, status
FROM vehicles
WHERE registration_number = 'SQL-DEMO-01';

UPDATE vehicles
SET odometer_km = 25
WHERE registration_number = 'SQL-DEMO-01';

DELETE FROM vehicles
WHERE registration_number = 'SQL-DEMO-01';
ROLLBACK;

-- 2. JOIN: trips, assigned driver/vehicle, shipment count and total cargo.
SELECT t.trip_code, t.status, v.registration_number, d.full_name AS driver,
       COUNT(s.id) AS shipment_count, COALESCE(SUM(s.weight_kg), 0) AS cargo_kg
FROM trips AS t
LEFT JOIN vehicles AS v ON v.id = t.vehicle_id
LEFT JOIN drivers AS d ON d.id = t.driver_id
LEFT JOIN trip_shipments AS ts ON ts.trip_id = t.id
LEFT JOIN shipments AS s ON s.id = ts.shipment_id
GROUP BY t.id, t.trip_code, t.status, v.registration_number, d.full_name
ORDER BY t.planned_start DESC;

-- 3. GROUP BY, aggregate functions, HAVING, and ORDER BY.
SELECT category, COUNT(*) AS expense_rows, SUM(amount) AS total_amount,
       AVG(amount) AS average_amount
FROM expenses
WHERE incurred_at >= CURRENT_DATE - INTERVAL 30 DAY
GROUP BY category
HAVING SUM(amount) > 0
ORDER BY total_amount DESC;

-- 4. NULL handling: unassigned trip rows and optional links.
SELECT trip_code,
       COALESCE(CAST(vehicle_id AS CHAR), 'unassigned') AS vehicle_id,
       COALESCE(CAST(driver_id AS CHAR), 'unassigned') AS driver_id
FROM trips
WHERE vehicle_id IS NULL OR driver_id IS NULL;

-- 5. Nested subquery: vehicles with at least one maintenance record.
SELECT registration_number, make, model
FROM vehicles
WHERE id IN (SELECT vehicle_id FROM maintenance_records);

-- 6. Correlated subquery: show vehicles whose recorded expenses exceed the
-- average expense total per vehicle. The inner query depends on outer v.id.
SELECT v.registration_number,
       (SELECT COALESCE(SUM(e.amount), 0)
        FROM expenses AS e WHERE e.vehicle_id = v.id) AS expense_total
FROM vehicles AS v
WHERE (SELECT COALESCE(SUM(e.amount), 0)
       FROM expenses AS e WHERE e.vehicle_id = v.id) >
      (SELECT AVG(vehicle_total)
       FROM (SELECT COALESCE(SUM(e2.amount), 0) AS vehicle_total
             FROM vehicles AS v2
             LEFT JOIN expenses AS e2 ON e2.vehicle_id = v2.id
             GROUP BY v2.id) AS per_vehicle)
ORDER BY expense_total DESC;

-- 7. Set operation: combine maintenance and expense events into one timeline.
SELECT 'maintenance' AS event_type, service_date AS event_date,
       service_type AS description, cost AS amount
FROM maintenance_records
UNION ALL
SELECT category AS event_type, DATE(incurred_at) AS event_date,
       COALESCE(description, vendor) AS description, amount
FROM expenses
ORDER BY event_date DESC, event_type;

-- 8. CTE: calculate per-vehicle fuel totals before comparing them.
WITH fuel_totals AS (
  SELECT vehicle_id, SUM(amount) AS fuel_amount
  FROM expenses
  WHERE category = 'fuel'
  GROUP BY vehicle_id
)
SELECT v.registration_number, COALESCE(f.fuel_amount, 0) AS fuel_amount
FROM vehicles AS v
LEFT JOIN fuel_totals AS f ON f.vehicle_id = v.id
ORDER BY fuel_amount DESC;

-- 8b. Recursive CTE (WITH RECURSIVE): trace multi-step shipment status transition chains.
WITH RECURSIVE status_chain AS (
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
SELECT shipment_id, tracking_number, step_no, old_status, new_status, transition_path, changed_at
FROM status_chain
ORDER BY shipment_id, step_no;

-- 9. Window function: rank vehicles by combined maintenance and operating cost.
WITH maintenance_totals AS (
  SELECT vehicle_id, SUM(cost) AS maintenance_amount
  FROM maintenance_records GROUP BY vehicle_id
)
SELECT v.registration_number,
       COALESCE(m.maintenance_amount, 0) AS maintenance_amount,
       fn_vehicle_expense_total(v.id) AS operating_amount,
       RANK() OVER (
         ORDER BY COALESCE(m.maintenance_amount, 0)
                + fn_vehicle_expense_total(v.id) DESC
       ) AS cost_rank
FROM vehicles AS v
LEFT JOIN maintenance_totals AS m ON m.vehicle_id = v.id
ORDER BY cost_rank, v.registration_number;

-- 10. Views.
SELECT * FROM v_fleet_dashboard;
SELECT * FROM v_monthly_expense_totals
ORDER BY month DESC, category;

-- 11. MySQL full-text search. This is the query used for shipment filtering;
-- it uses the FULLTEXT index, not LIKE or substring matching.
SELECT id, tracking_number, customer_name, description
FROM shipments
WHERE MATCH(description, customer_name, origin, destination)
      AGAINST ('fragile ceramic delivery' IN NATURAL LANGUAGE MODE)
ORDER BY created_at DESC
LIMIT 100;

-- 12. Index/query-plan analysis. On the seeded local database, MySQL 9.7.1
-- chose idx_shipments_status_created for the status filter and reverse order:
--   Index lookup on shipments using idx_shipments_status_created
--   (status = 'pending') (reverse)
EXPLAIN
SELECT id, tracking_number
FROM shipments
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 20;

-- The following range query chose idx_expenses_category_date and applied an
-- index range condition on category plus incurred_at in the measured run.
EXPLAIN
SELECT category, SUM(amount)
FROM expenses
WHERE category = 'fuel'
  AND incurred_at >= CURRENT_DATE - INTERVAL 30 DAY
GROUP BY category;

-- 13. Stored function, procedure, and transaction entry point.
SELECT registration_number, fn_vehicle_expense_total(id) AS expense_total
FROM vehicles;

-- Do not call sp_assign_trip with arbitrary IDs for a demo. The application
-- validates the request and calls this procedure inside an isolated local DB.
-- CALL sp_assign_trip(<planned_trip_id>, <available_vehicle_id>, <valid_driver_id>);

-- 14. Trigger behavior is demonstrated by the application:
-- inserting/changing shipment status populates shipment_status_history, and
-- a delivered shipment cannot transition to a non-delivered state.
SELECT shipment_id, old_status, new_status, changed_at
FROM shipment_status_history
ORDER BY changed_at DESC
LIMIT 20;
