# FleetDesk — Fleet and Logistics Management

A local DBMS Level 3 project for managing vehicles, drivers, shipments, trips, maintenance, expenses, and incidents. MySQL is the source of truth for operational records. PostgreSQL with pgvector stores only the incident search index. A local Ollama model creates real embeddings; the application does not call paid or cloud AI services.

## Features

- Dashboard totals, shipment status counts, recent incidents, and expense totals are queried from MySQL.
- Management pages provide validated create, update, delete, search, and status workflows for fleet records.
- Trip assignment calls a MySQL stored procedure that locks and validates the trip, vehicle, driver, and shipments before committing.
- Shipment status triggers write an audit history and prevent delivered shipments from reverting.
- Vehicle, shipment, and incident images are saved as actual `MEDIUMBLOB` bytes in separate MySQL tables. The server accepts PNG, JPEG, WebP, and GIF files up to 5 MiB.
- Incident descriptions are embedded locally with `nomic-embed-text` (768 dimensions), synchronized to PostgreSQL through a retryable MySQL outbox, and ranked using pgvector cosine distance.
- Admin and Operations roles use scrypt password hashes and opaque server-side sessions. User management is Admin-only.
- Searchable shipments use MySQL full-text indexing. Reports demonstrate views, a stored function, joins, correlated subqueries, aggregates, and a window function.

## Stack and template

The interface reuses the Vercel Admin Dashboard template’s App Router layout, navigation, Tailwind setup, and shadcn-style components from [vercel/nextjs-postgres-nextauth-tailwindcss-template](https://github.com/vercel/nextjs-postgres-nextauth-tailwindcss-template). The template’s MIT license is retained in `LICENSE.md`. Its original PostgreSQL/Auth.js OAuth demo data path was removed; app authentication and operational access now use local MySQL sessions. PostgreSQL is reserved for pgvector incident search.

- Next.js App Router, React, TypeScript, Tailwind CSS
- MySQL Community Server for relational data, full-text search, and routines
- PostgreSQL + pgvector for embeddings and nearest-neighbor search
- Ollama + `nomic-embed-text` running on this computer
- Vitest for unit and local API integration tests

## Local setup (macOS + Homebrew)

The checked-in setup scripts target a local Homebrew MySQL and PostgreSQL installation. The app databases bind to loopback only and use their own project data directories and ports (`3307` and `5433`), so they do not require a cloud account or deployment.

1. Install Homebrew if it is not already installed, then install the local runtimes:

   ```sh
   brew install node mysql postgresql@18 pgvector ollama
   export PATH="$(brew --prefix mysql)/bin:$(brew --prefix postgresql@18)/bin:$PATH"
   node --version
   npm --version
   ```

   Next.js 16 requires Node.js 20.9.0 or newer. PostgreSQL 18 and the Homebrew pgvector formula are the versions used for the documented run. The formula pages list the current install commands for [MySQL](https://formulae.brew.sh/formula/mysql), [PostgreSQL 18](https://formulae.brew.sh/formula/postgresql@18), [pgvector](https://formulae.brew.sh/formula/pgvector), and [Ollama](https://formulae.brew.sh/formula/ollama).

2. Open Terminal in the project directory and install JavaScript dependencies:

   ```sh
   npm install
   ```

3. Create the local environment, start the project-isolated databases, and create both schemas:

   ```sh
   ./scripts/setup-local.sh
   npm run db:seed
   ```

   `setup-local.sh` creates a random `.env.local` with mode `600` if one does not exist. It initializes MySQL on `127.0.0.1:3307`, PostgreSQL on `127.0.0.1:5433`, grants the local `fleet_app` user access to the project databases, and loads the MySQL tables/routines and pgvector table. Seed data is fictional and safe to reload; insertions are idempotent.

4. Start Ollama in its own Terminal window, leaving it open:

   ```sh
   OLLAMA_MODELS="$PWD/.local-data/ollama" ollama serve
   ```

5. In another Terminal window, download the local embedding model and index the seeded incident descriptions:

   ```sh
   npm run model:pull
   npm run db:sync-vectors
   ```

   `nomic-embed-text` is an embedding-only model with an Ollama local API; the model registry lists its pull command and [model details](https://ollama.com/library/nomic-embed-text). The upstream model card identifies the model as Apache-2.0 licensed: [nomic-ai/nomic-embed-text-v1.5](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5).

6. Create the first Admin. Replace the example name, email, and password with your own values (at least 12 characters):

   ```sh
   FLEET_ADMIN_PASSWORD='replace-with-your-own-12-character-password' \
     npm run admin:create -- --name "Fleet Administrator" --email admin@example.local
   ```

   The password is salted and hashed with scrypt before it is inserted. This one-time command refuses to run after any account exists; later accounts are managed on the Admin-only **User management** page.

7. Start the app:

   ```sh
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) and sign in with the Admin account. Keep the Ollama terminal open for incident creation and similarity search. MySQL and PostgreSQL run as local processes after the setup script starts them.

### Stop and restart

- Stop Next.js and Ollama with `Ctrl+C` in their terminals.
- Stop the project-local databases with `./scripts/stop-local-databases.sh`.
- On a later run, start databases with `./scripts/start-local-databases.sh`, start Ollama with the command above, then run `npm run dev`. Do not run `setup-local.sh` again unless you intentionally want to reload the schema.
- Project data lives under `.local-data/`; it is ignored by Git. `.env.local` and model files are ignored as well.

## Commands

```sh
npm run typecheck        # TypeScript check
npm run lint             # ESLint
npm test                 # unit tests (no DB required)
npm run test:integration # real local API + MySQL + PostgreSQL + Ollama; requires app at localhost:3000
npm run build            # optimized production bundle (webpack)
npm start                # serve the built app at localhost:3000
npm run db:seed          # insert/update fictional demonstration records
npm run db:sync-vectors  # retry pending/failed incident embedding jobs
```

For integration tests, export credentials for an existing Admin first:

```sh
export TEST_ADMIN_EMAIL=admin@example.local
export TEST_ADMIN_PASSWORD='your-local-admin-password'
npm run test:integration
unset TEST_ADMIN_EMAIL TEST_ADMIN_PASSWORD
```

The integration suite creates uniquely named test records and removes them when it finishes. It requires the isolated project databases, a model-enabled local Ollama server, and the running Next.js app. See [`docs/testing.md`](docs/testing.md) for the exact test coverage and observed results.

## Documentation map

- [`docs/architecture.md`](docs/architecture.md) — problem, scope, architecture, ER model, mappings, roles, and transaction boundaries.
- [`docs/data-dictionary.md`](docs/data-dictionary.md) — relational schema, keys, constraints, and normalization.
- [`docs/sql-examples.sql`](docs/sql-examples.sql) — runnable DDL/DML examples, joins, aggregates, subqueries, set operations, CTEs, windows, full-text search, and plans.
- [`docs/vector-search.md`](docs/vector-search.md) — Ollama model, embedding dimensions, cosine search, outbox retries, and limitations.
- [`docs/testing.md`](docs/testing.md) — test workflow, cases, actual results, and tested runtime versions.
- [`docs/troubleshooting.md`](docs/troubleshooting.md) — local service and login fixes.
- [`docs/demo-script.md`](docs/demo-script.md) — short project evaluation walkthrough.

The browser-run dashboard was visually verified with the seeded MySQL data. Its observed live totals are recorded in [`docs/testing.md`](docs/testing.md); the browser screenshot was displayed during verification but is not saved as a project image file.

## Limitations

- The setup scripts are written for macOS/Homebrew; Linux and Windows need equivalent local database installation and service-start commands.
- PostgreSQL vector rows refer to MySQL incident IDs by application-managed identifier; no cross-database foreign key or distributed transaction exists.
- Image size is capped at 5 MiB, and only PNG/JPEG/WebP/GIF signatures are accepted.
- The current local integration suite uses the project’s ignored local database directories and uniquely prefixed rows; do not repoint it at personal or production databases.
- The app uses small, fictional seed data for demonstration. Query plans and dashboard counts will change with data volume and local model output.

## Project outcome

This project demonstrates a normalized relational design, referential integrity, procedural SQL, row locking, transaction rollback, binary image storage, full-text search, application-level role enforcement, a durable cross-database outbox, and genuine vector similarity search in one locally runnable application.
