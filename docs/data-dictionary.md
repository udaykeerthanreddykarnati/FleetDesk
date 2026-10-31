# Data dictionary and normalization

The executable definitions live in [`../mysql/001_schema.sql`](../mysql/001_schema.sql), [`../mysql/002_programmability.sql`](../mysql/002_programmability.sql), and [`../postgres/001_vector_schema.sql`](../postgres/001_vector_schema.sql). MySQL uses InnoDB, `utf8mb4`, foreign keys, enum domains for fixed statuses, and decimal types for money/weight. Identifiers are unsigned `BIGINT`; UI validation additionally requires safe positive integer IDs.

## MySQL operational schema

### Accounts and session data

| Table | Columns | Keys and rules |
| --- | --- | --- |
| `users` | `id BIGINT`; `full_name VARCHAR(120)`; `email VARCHAR(254)`; `password_hash VARCHAR(255)`; `role ENUM(admin, operations)`; `is_active BOOLEAN`; `created_at`, `updated_at` | PK `id`; unique `email`; password column stores the scrypt scheme/salt/hash only. |
| `app_sessions` | `token_hash BINARY(32)`; `user_id BIGINT`; `expires_at DATETIME`; `created_at` | PK `token_hash`; FK to `users` with cascade delete; expiry index. Raw cookie token is never stored. |

### Fleet, routes, and operating records

| Table | Columns | Keys and rules |
| --- | --- | --- |
| `vehicles` | `id`; `registration_number VARCHAR(24)`; `vehicle_type ENUM(van, truck, tractor, trailer)`; `make`, `model`; `year SMALLINT`; `capacity_kg DECIMAL(10,2)`; `odometer_km INT`; `status ENUM(available, on_trip, maintenance, inactive)`; timestamps | PK `id`; unique registration; checks `year BETWEEN 1980 AND 2100`, `capacity_kg > 0`. |
| `drivers` | `id`; `full_name`; `license_number VARCHAR(40)`; `phone`; nullable unique `email`; `license_expires_on DATE`; `status ENUM(available, on_trip, on_leave, inactive)`; timestamps | PK `id`; unique license and email; non-empty name check. |
| `shipments` | `id`; unique `tracking_number`; `customer_name`; `description`; `origin`; `destination`; `weight_kg DECIMAL(10,2)`; `status ENUM(pending, assigned, in_transit, delivered, delayed, cancelled)`; nullable expected/delivery times; timestamps | PK `id`; positive weight check; `(status, created_at)` index; composite FULLTEXT index for description/customer/origin/destination. |
| `trips` | `id`; unique `trip_code`; nullable `vehicle_id`, `driver_id`; `status ENUM(planned, assigned, in_progress, completed, cancelled)`; start/end locations; planned/actual times; timestamps | FKs to vehicle and driver (`RESTRICT` on delete); checks that a planned trip has no assignees and a non-planned trip has both; indexes by status/start, vehicle/status, driver/status. |
| `trip_shipments` | `trip_id`; `shipment_id`; `added_at` | Composite PK `(trip_id, shipment_id)`; trip FK cascades, shipment FK restricts. Models the M:N assignment without a comma-separated ID list. |
| `maintenance_records` | `id`; `vehicle_id`; `service_type`; nullable `notes`; `service_date`; `cost DECIMAL(12,2)`; nullable `odometer_km`; `created_at` | Vehicle FK (`RESTRICT`); non-negative cost check; date index. |
| `expenses` | `id`; nullable `vehicle_id`, `trip_id`; `category ENUM(fuel, toll, repair, other)`; `vendor`; nullable `description`; `amount DECIMAL(12,2)`; nullable `quantity DECIMAL(10,2)`, `unit`; `incurred_at`; `created_at` | Vehicle FK (`RESTRICT`), trip FK (`SET NULL`); non-negative amount; date and `(category, incurred_at)` indexes. |
| `incidents` | `id`; nullable `vehicle_id`, `driver_id`, `trip_id`; `summary`; `description TEXT`; `severity ENUM(low, medium, high, critical)`; `incident_status ENUM(open, investigating, resolved)`; `occurred_at`; `embedding_status ENUM(pending, synced, failed)`; nullable `embedding_error`; timestamps | Optional FKs use `SET NULL`; `(occurred_at, severity)` index; FULLTEXT index on summary/description. |

### Images, audit, and synchronization

| Table | Columns | Keys and rules |
| --- | --- | --- |
| `vehicle_images` | `vehicle_id`; `filename`; `mime_type`; `file_size`; `image_data MEDIUMBLOB`; nullable `description`; `uploaded_at` | `vehicle_id` is both PK and cascading FK. One actual image blob per vehicle. |
| `shipment_images` | `shipment_id`; same image metadata and `MEDIUMBLOB` | `shipment_id` is PK/FK to shipments, cascading. |
| `incident_images` | `incident_id`; same image metadata and `MEDIUMBLOB` | `incident_id` is PK/FK to incidents, cascading. |
| `shipment_status_history` | `id`; `shipment_id`; nullable `old_status`; `new_status`; `changed_at`; nullable `changed_by` | FKs to shipment (cascade) and user (`SET NULL`); `(shipment_id, changed_at)` index. Trigger-populated on insert and status changes. |
| `incident_vector_jobs` | `id`; `incident_id`; `operation ENUM(upsert, delete)`; nullable snapshot `summary`, `description`, `severity`, `occurred_at`; `state ENUM(pending, processing, done, failed)`; `attempts`; nullable `last_error`; `created_at`; nullable `processed_at` | Queue-state and incident-order indexes. It intentionally has no FK to incidents so a delete job survives deletion of its source. |

`v_monthly_expense_totals` groups expenses by calendar month and category. `v_fleet_dashboard` returns a single row of fleet, trip, delivery, maintenance, fuel, and other-expense totals. See the query examples for definitions and sample reads.

## PostgreSQL vector schema

`incident_vectors` is defined in the vector database (`fleet_vectors`):

| Column | Type | Meaning |
| --- | --- | --- |
| `incident_id` | `BIGINT PRIMARY KEY` | Corresponding MySQL incident ID; application-managed, so there is no cross-database FK. |
| `summary`, `description`, `severity` | `TEXT` | Search-result snapshot and metadata. |
| `occurred_at` | `TIMESTAMPTZ` | Event time snapshot. |
| `embedding` | `VECTOR(768)` | Genuine local model vector; all query and stored vectors use the same dimension. |
| `updated_at` | `TIMESTAMPTZ` | Index row update time. |

Indexes: HNSW on `embedding vector_cosine_ops` and B-tree on `severity`. MySQL remains authoritative for incident status and the result page rechecks each vector ID against MySQL.

## Functional dependencies

Representative dependencies (candidate-key determinants are underlined in the prose):

- `users`: `id → full_name, email, password_hash, role, is_active, timestamps`; unique `email → id, ...`.
- `vehicles`: `id → all non-key vehicle attributes`; unique `registration_number → id, ...`.
- `drivers`: `id → driver attributes`; unique `license_number → id, ...`; nullable unique `email → id, ...` when present.
- `shipments`: `id → shipment attributes`; unique `tracking_number → id, ...`.
- `trips`: `id → trip attributes`; unique `trip_code → id, ...`.
- `trip_shipments`: `(trip_id, shipment_id) → added_at`; neither side alone determines the pair’s membership.
- `maintenance_records`: `id → vehicle_id, service details, date, cost`.
- `expenses`: `id → vehicle/trip links, category, vendor, amount, quantity/unit, time`.
- `incidents`: `id → links, content, severity/status, time, embedding status`.
- Each image table: owner key (`vehicle_id`, `shipment_id`, or `incident_id`) determines the image metadata and binary bytes.
- `shipment_status_history`: `id → one transition event`; `incident_vector_jobs`: `id → one queued operation and snapshot`.

## Normalization rationale

### 1NF

Every field has one value from its domain. A trip’s shipment membership is represented by rows in `trip_shipments`, not a delimited string. Expenses and status history are separate rows. Binary image bytes are one BLOB value in a constrained image relation.

### 2NF

Most entity tables use a single-column primary key, so each non-key attribute depends on the entire key. In the only composite-key relation, `trip_shipments`, `added_at` records when that trip/shipment pairing was created and depends on the pair; no shipment-only or trip-only descriptive fields are duplicated there.

### 3NF

Non-key columns describe their own entity, not another entity reachable through an FK. Vehicle make/model are stored on `vehicles`, driver license data on `drivers`, and route/customer description on `shipments`. Trip rows store IDs rather than duplicate vehicle/driver names. Totals, counts, and ranks are calculated by queries/views instead of copied into operational rows.

### BCNF

For the modeled operational relations, every non-trivial determinant is a candidate key: primary IDs, unique business keys (email, registration number, license number, tracking number, trip code), the composite bridge key, or an image owner key. The outbox is an event log with deliberate value snapshots; snapshots make retries deterministic and survive source deletion. That queue has a different purpose from normalized current-state entities.

## Constraints and statuses

Database ENUMs limit the allowed domain. App schemas also reject invalid input before SQL. `sp_assign_trip` is the authoritative dispatch rule: it requires an unassigned planned trip, available vehicle and driver, unexpired license, a combined shipment load within vehicle capacity, eligible shipment states, and no other active trip holding one of the same shipments. Foreign keys prevent deleting in-use vehicles, drivers, or shipments. Delivered shipments cannot transition back to a previous state.
