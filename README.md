# FleetDesk — Fleet and Logistics Management

A local DBMS Level 3 experiential learning project managing vehicles, drivers, shipments, trips, maintenance, expenses, and incidents. 

- **MySQL** is the primary source of truth for all relational operations, binary image storage, transaction boundaries, triggers, and stored procedures.
- **PostgreSQL (`pgvector`)** stores 768-dimensional normalized incident embeddings for semantic cosine similarity search.
- **In-process Node.js embedding generator**: Embeddings are computed deterministically in-process in `backend/lib/vector.ts` (no external Ollama daemon or paid cloud AI required).

---

## Teammate & Evaluation Quick-Start

If you just cloned this repository or need to run and explain the project for the viva:

### 1. Run the project in 3 steps
```sh
# Step 1: Ensure MySQL and PostgreSQL are in your PATH
export PATH="$(brew --prefix mysql)/bin:$(brew --prefix postgresql@18)/bin:$PATH"

# Step 2: Start local MySQL (:3307) and PostgreSQL (:5433)
./backend/scripts/start-local-databases.sh

# Step 3: Start the Next.js web application
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

- **Default Accounts (2 Roles)**:
  - **Admin Role**:
    - Email: `demo-admin@fleetdesk.local`
    - Password: `admin12345678`
    - Permissions: Full fleet management + **User Management (`/users`)** + Delete permissions.
  - **Operations Role**:
    - Email: `demo-ops@fleetdesk.local`
    - Password: `operations1234`
    - Permissions: Fleet management, dispatching, and incident reporting (User Management is restricted with `403 Forbidden`).

---

### 2. How to Explain the Project During the Viva (5 Key Demos)

When the professor asks you to demonstrate your work, show these 5 screens:

1. **Transactional Stored Procedure (`/trips`)**:
   - Go to **Trips & assignments**. Click **Assign trip**.
   - Behind the scenes, this executes [`sp_assign_trip`](backend/sql/mysql/002_programmability.sql) in MySQL using `START TRANSACTION`, `SELECT ... FOR UPDATE` row locks, capacity checks, and driver license expiry validation with automatic rollback on error.
2. **PostgreSQL Vector Database & Cosine Search (`/similar-incidents`)**:
   - Go to **Vector search (pgvector)**.
   - Shows live PostgreSQL telemetry: `pgvector v0.8.7`, `VECTOR(768)`, and `HNSW Cosine Index`.
   - Type a natural sentence (e.g., *"coolant leak and high engine temperature on highway"*) to demonstrate real-time nearest-neighbor retrieval using PostgreSQL's `<=>` cosine distance operator.
3. **Triggers & Full-Text Search (`/shipments`)**:
   - Search shipments using words like *"ceramic"* or *"electronics"* (runs MySQL `MATCH ... AGAINST` FULLTEXT search).
   - Updating shipment statuses automatically fires audit triggers (`trg_shipments_history_after_update`), and trying to revert a delivered shipment triggers an exception (`trg_shipments_status_before_update`).
4. **Complex Analytical Queries (`/reports`)**:
   - Displays MySQL Views (`v_monthly_expense_totals`), Window Functions (`RANK() OVER` cost ranking), Correlated `EXISTS` subqueries, and a Recursive CTE (`WITH RECURSIVE status_chain`) tracing shipment status transition paths.
5. **Real Binary Image Storage & RBAC**:
   - Look at the **Vehicles**, **Shipments**, and **Incidents** tables. The images are stored directly in MySQL as `MEDIUMBLOB` bytes in dedicated tables (`vehicle_images`, `shipment_images`, `incident_images`).
   - Logging in as `admin` unlocks the **User management** tab to manage operational staff accounts with salted `scrypt` password hashes.

---

## Repository layout

- `app/` — Next.js 16 App Router pages (`app/(dashboard)/`) and REST API route handlers (`app/api/*`).
- `frontend/` — React UI components (`frontend/components/`) and client utilities (`frontend/lib/`).
- `backend/`
  - `backend/sql/mysql/` — Relational schema DDL (`001_schema.sql`) and programmability routines (`002_programmability.sql`).
  - `backend/sql/postgres/` — Vector schema DDL with HNSW cosine index (`001_vector_schema.sql`).
  - `backend/lib/` — Database connection pools (`db.ts`, `pg.ts`), query modules (`data.ts`), in-process vector embedding generator (`vector.ts`), and password hashing (`password.ts`).
  - `backend/scripts/` — Automated local database setup (`setup-local.sh`, `start-local-databases.sh`, `seed.ts`).
- `docs/` — Evaluation architecture, ER diagram, data dictionary, testing results, and runnable SQL queries (`docs/sql-examples.sql`).

## Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Radix UI.
- **Relational DB**: MySQL 9.7 Community Server (`127.0.0.1:3307`, db: `fleet_logistics`).
- **Vector DB**: PostgreSQL 18 + `pgvector` (`127.0.0.1:5433`, db: `fleet_vectors`).
- **Auth**: Salted `scrypt` password hashing + HTTP-only sessions with `admin` and `operations` RBAC.
- **Testing**: Vitest for unit tests (`tests/core.test.ts`) and API integration tests (`tests/api.integration.test.ts`).

## First-Time Setup Instructions (For New Machines)

If setting up on a completely fresh machine:

1. Install local runtimes via Homebrew:
   ```sh
   brew install node mysql postgresql@18 pgvector
   export PATH="$(brew --prefix mysql)/bin:$(brew --prefix postgresql@18)/bin:$PATH"
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

3. Initialize local databases and seed records:
   ```sh
   ./backend/scripts/setup-local.sh
   npm run db:seed
   npm run db:sync-vectors
   ```

4. Start the app:
   ```sh
   npm run dev
   ```

### Stop and restart

- Stop Next.js with `Ctrl+C` in its terminal.
- Stop the project-local databases with `./backend/scripts/stop-local-databases.sh`.
- On a later run, start databases with `./backend/scripts/start-local-databases.sh`, then run `npm run dev`. Do not run `setup-local.sh` again unless you intentionally want to reload the schema.
- Project data lives under `.local-data/`; it is ignored by Git. `.env.local` is ignored as well.

## Application screenshots

![Vehicles page with MySQL MEDIUMBLOB images](docs/screenshots/website-vehicles.png)

![Shipments page with MySQL MEDIUMBLOB images](docs/screenshots/website-shipments.png)

![Incidents page with MySQL MEDIUMBLOB images and pgvector sync status](docs/screenshots/website-incidents.png)

## Commands

```sh
npm run typecheck        # TypeScript check
npm run lint             # ESLint
npm test                 # unit tests (no DB required)
npm run test:integration # real local API + MySQL + PostgreSQL; requires app at localhost:3000
npm run build            # optimized production bundle (webpack)
npm start                # serve the built app at localhost:3000
npm run db:seed          # insert/update fictional demonstration records and 30 BLOB images
npm run db:sync-vectors  # synchronize pending/failed incident embedding jobs to PostgreSQL pgvector
```

For integration tests, export credentials for an existing Admin first:

```sh
export TEST_ADMIN_EMAIL=admin@example.local
export TEST_ADMIN_PASSWORD='your-local-admin-password'
npm run test:integration
unset TEST_ADMIN_EMAIL TEST_ADMIN_PASSWORD
```

The integration suite creates uniquely named test records and removes them when it finishes. See [`docs/testing.md`](docs/testing.md) for the exact test coverage and observed results.

## Documentation map

- [`docs/architecture.md`](docs/architecture.md) — problem, scope, architecture, ER model, mappings, roles, transaction boundaries, conclusion, and future enhancements.
- [`docs/data-dictionary.md`](docs/data-dictionary.md) — relational schema, keys, constraints, and normalization.
- [`docs/sql-examples.sql`](docs/sql-examples.sql) — runnable DDL (`CREATE`, `ALTER`, `DROP`)/DML examples, joins, aggregates, subqueries, recursive CTEs, set operations, windows, full-text search, and plans.
- [`docs/vector-search.md`](docs/vector-search.md) — 768-dim embedding generator, `pgvector` cosine search, outbox retries, and limitations.
- [`docs/testing.md`](docs/testing.md) — test workflow, cases, actual results, and tested runtime versions.
- [`docs/troubleshooting.md`](docs/troubleshooting.md) — local service and login fixes.
- [`docs/demo-script.md`](docs/demo-script.md) — short project evaluation walkthrough.

## Conclusion and future enhancements

This project demonstrates a normalized 3NF/BCNF relational design in MySQL (`backend/sql/mysql/001_schema.sql`), referential integrity, procedural SQL (`sp_assign_trip`, `fn_vehicle_expense_total`, and three shipment audit triggers in `backend/sql/mysql/002_programmability.sql`), row locking, transaction rollback, binary `MEDIUMBLOB` image storage, full-text search, recursive CTEs (`WITH RECURSIVE`), window functions, application-level RBAC, a durable cross-database outbox, and genuine `pgvector` HNSW cosine similarity search in PostgreSQL (`backend/sql/postgres/001_vector_schema.sql`) in one locally runnable application.

Future enhancements include:
- Real-time GPS telemetry ingestion partitioned by timestamp for live route deviation alerts.
- Automated preventive maintenance scheduling triggered when `odometer_km` crosses service intervals.
- Multi-depot dispatch optimization and customer-facing shipment tracking portals.
