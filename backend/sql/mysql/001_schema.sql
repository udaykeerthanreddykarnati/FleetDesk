CREATE DATABASE IF NOT EXISTS fleet_logistics CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE fleet_logistics;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','operations') NOT NULL DEFAULT 'operations',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash BINARY(32) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_expiry (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS drivers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  license_number VARCHAR(40) NOT NULL UNIQUE,
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(254) NULL UNIQUE,
  license_expires_on DATE NOT NULL,
  status ENUM('available','on_trip','on_leave','inactive') NOT NULL DEFAULT 'available',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_driver_name CHECK (CHAR_LENGTH(TRIM(full_name)) > 1)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehicles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  registration_number VARCHAR(24) NOT NULL UNIQUE,
  vehicle_type ENUM('van','truck','tractor','trailer') NOT NULL,
  make VARCHAR(60) NOT NULL,
  model VARCHAR(60) NOT NULL,
  year SMALLINT UNSIGNED NOT NULL,
  capacity_kg DECIMAL(10,2) NOT NULL,
  odometer_km INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('available','on_trip','maintenance','inactive') NOT NULL DEFAULT 'available',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_vehicle_year CHECK (year BETWEEN 1980 AND 2100),
  CONSTRAINT chk_vehicle_capacity CHECK (capacity_kg > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shipments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tracking_number VARCHAR(32) NOT NULL UNIQUE,
  customer_name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NOT NULL,
  origin VARCHAR(180) NOT NULL,
  destination VARCHAR(180) NOT NULL,
  weight_kg DECIMAL(10,2) NOT NULL,
  status ENUM('pending','assigned','in_transit','delivered','delayed','cancelled') NOT NULL DEFAULT 'pending',
  expected_delivery DATETIME NULL,
  delivered_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_shipment_weight CHECK (weight_kg > 0),
  INDEX idx_shipments_status_created (status, created_at),
  FULLTEXT INDEX ft_shipments_description (description, customer_name, origin, destination)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trips (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  trip_code VARCHAR(24) NOT NULL UNIQUE,
  vehicle_id BIGINT UNSIGNED NULL,
  driver_id BIGINT UNSIGNED NULL,
  status ENUM('planned','assigned','in_progress','completed','cancelled') NOT NULL DEFAULT 'planned',
  start_location VARCHAR(180) NOT NULL,
  end_location VARCHAR(180) NOT NULL,
  planned_start DATETIME NOT NULL,
  actual_start DATETIME NULL,
  actual_end DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trips_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT,
  CONSTRAINT fk_trips_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE RESTRICT,
  CONSTRAINT chk_trip_assignment CHECK ((vehicle_id IS NULL AND driver_id IS NULL AND status = 'planned') OR (vehicle_id IS NOT NULL AND driver_id IS NOT NULL AND status <> 'planned')),
  INDEX idx_trips_status_start (status, planned_start),
  INDEX idx_trips_vehicle_status (vehicle_id, status),
  INDEX idx_trips_driver_status (driver_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trip_shipments (
  trip_id BIGINT UNSIGNED NOT NULL,
  shipment_id BIGINT UNSIGNED NOT NULL,
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trip_id, shipment_id),
  CONSTRAINT fk_trip_shipments_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_trip_shipments_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS maintenance_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vehicle_id BIGINT UNSIGNED NOT NULL,
  service_type VARCHAR(100) NOT NULL,
  notes VARCHAR(1000) NULL,
  service_date DATE NOT NULL,
  cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  odometer_km INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_maintenance_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT,
  CONSTRAINT chk_maintenance_cost CHECK (cost >= 0),
  INDEX idx_maintenance_date (service_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS expenses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vehicle_id BIGINT UNSIGNED NULL,
  trip_id BIGINT UNSIGNED NULL,
  category ENUM('fuel','toll','repair','other') NOT NULL,
  vendor VARCHAR(120) NOT NULL,
  description VARCHAR(300) NULL,
  amount DECIMAL(12,2) NOT NULL,
  quantity DECIMAL(10,2) NULL,
  unit VARCHAR(20) NULL,
  incurred_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_expenses_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT,
  CONSTRAINT fk_expenses_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL,
  CONSTRAINT chk_expense_amount CHECK (amount >= 0),
  INDEX idx_expenses_incurred (incurred_at),
  INDEX idx_expenses_category_date (category, incurred_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS incidents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vehicle_id BIGINT UNSIGNED NULL,
  driver_id BIGINT UNSIGNED NULL,
  trip_id BIGINT UNSIGNED NULL,
  summary VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  severity ENUM('low','medium','high','critical') NOT NULL,
  incident_status ENUM('open','investigating','resolved') NOT NULL DEFAULT 'open',
  occurred_at DATETIME NOT NULL,
  embedding_status ENUM('pending','synced','failed') NOT NULL DEFAULT 'pending',
  embedding_error VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_incidents_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
  CONSTRAINT fk_incidents_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
  CONSTRAINT fk_incidents_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL,
  INDEX idx_incidents_date_severity (occurred_at, severity),
  FULLTEXT INDEX ft_incidents_description (summary, description)
) ENGINE=InnoDB;

-- Actual image bytes are stored in these three constrained tables.
CREATE TABLE IF NOT EXISTS vehicle_images (
  vehicle_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(32) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  image_data MEDIUMBLOB NOT NULL,
  description VARCHAR(200) NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vehicle_images_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shipment_images (
  shipment_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(32) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  image_data MEDIUMBLOB NOT NULL,
  description VARCHAR(200) NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shipment_images_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS incident_images (
  incident_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(32) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  image_data MEDIUMBLOB NOT NULL,
  description VARCHAR(200) NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_incident_images_incident FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shipment_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shipment_id BIGINT UNSIGNED NOT NULL,
  old_status ENUM('pending','assigned','in_transit','delivered','delayed','cancelled') NULL,
  new_status ENUM('pending','assigned','in_transit','delivered','delayed','cancelled') NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changed_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_shipment_history_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE,
  CONSTRAINT fk_shipment_history_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_shipment_history_time (shipment_id, changed_at)
) ENGINE=InnoDB;

-- A durable outbox makes MySQL-to-PostgreSQL synchronization retryable.
CREATE TABLE IF NOT EXISTS incident_vector_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  incident_id BIGINT UNSIGNED NOT NULL,
  operation ENUM('upsert','delete') NOT NULL,
  summary VARCHAR(180) NULL,
  description TEXT NULL,
  severity VARCHAR(16) NULL,
  occurred_at DATETIME NULL,
  state ENUM('pending','processing','done','failed') NOT NULL DEFAULT 'pending',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  last_error VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  INDEX idx_vector_jobs_state (state, created_at),
  INDEX idx_vector_jobs_incident (incident_id, id)
) ENGINE=InnoDB;

-- Demonstrate ALTER TABLE DDL on operational relations.
ALTER TABLE vehicles COMMENT = 'Fleet vehicles and capacity specifications';
ALTER TABLE shipments COMMENT = 'Customer cargo shipments tracked across trips';
ALTER TABLE incidents COMMENT = 'Operational incidents synchronized to pgvector';

CREATE OR REPLACE VIEW v_monthly_expense_totals AS
SELECT DATE_FORMAT(incurred_at, '%Y-%m') AS month,
       category,
       COUNT(*) AS expense_count,
       SUM(amount) AS total_amount
FROM expenses
GROUP BY DATE_FORMAT(incurred_at, '%Y-%m'), category;

CREATE OR REPLACE VIEW v_fleet_dashboard AS
SELECT
  (SELECT COUNT(*) FROM vehicles) AS total_vehicles,
  (SELECT COUNT(*) FROM vehicles WHERE status='available') AS available_vehicles,
  (SELECT COUNT(*) FROM trips WHERE status IN ('assigned','in_progress')) AS active_trips,
  (SELECT COUNT(*) FROM shipments WHERE status='delivered') AS delivered_shipments,
  (SELECT COALESCE(SUM(cost), 0) FROM maintenance_records) AS maintenance_costs,
  (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE category='fuel') AS fuel_costs,
  (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE category<>'fuel') AS other_expenses;
