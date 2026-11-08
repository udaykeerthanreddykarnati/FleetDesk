# Incident similarity search

## Embedding generator and vector definition

- Runtime: In-process deterministic semantic embedding engine in `backend/lib/vector.ts` (runs natively inside Node.js; no external Ollama daemon or cloud API needed).
- Features hashed into the 768-dimensional vector: stemmed unigrams, word bigrams, character trigrams, and domain-specific fleet/mechanical semantic concept clusters (cooling/overheating, brakes, tires/wheels, cargo/dock damage, weather/road closures, electrical/battery, refrigeration/cold-chain, glass/visibility), followed by L2 normalization to unit length.
- Dimensions: 768; `backend/lib/vector.ts` validates that every vector has exactly 768 finite numbers.
- PostgreSQL type: `VECTOR(768)` in `incident_vectors` (`backend/sql/postgres/001_vector_schema.sql`).
- Distance: `pgvector` cosine distance, the `<=>` operator. HNSW index operator class: `vector_cosine_ops`.
- Similarity shown in UI: `clamp(1 - cosine_distance, 0, 1)`. It is a normalized display value, not a calibrated probability.

## Data flow

1. A new or edited incident and an `incident_vector_jobs` **upsert** snapshot are committed together in one MySQL transaction.
2. The sync worker claims a job using a MySQL transaction and `FOR UPDATE SKIP LOCKED`, increments its attempt counter, and marks it processing.
3. For an upsert, the worker combines summary and description, asks Ollama for the 768-value embedding, and upserts metadata/vector in PostgreSQL.
4. On success it marks the MySQL job done and the current incident `embedding_status='synced'`. On failure it saves a bounded error and sets the incident status to `failed`.
5. A search embeds the user query, asks pgvector for the nearest rows ordered by `embedding <=> $query`, and loads current incident status from MySQL by those IDs. Orphan vector rows are not displayed.
6. On incident deletion, a MySQL delete job is enqueued before the source row is deleted. Because the outbox is not FK-cascaded, the worker can still remove the PostgreSQL row.

MySQL and PostgreSQL are separate databases. There is no distributed transaction. The outbox makes a partially completed cross-database update observable and retryable, but while a job is pending/failed the vector index can briefly be stale. The Incidents page exposes synchronization status and a retry action; `npm run db:sync-vectors` also retries pending and failed jobs.

## Search query

The database query executed by `similarIncidents()` is equivalent to:

```sql
SELECT incident_id, summary, description, severity, occurred_at,
       embedding <=> $1::vector AS distance
FROM incident_vectors
ORDER BY embedding <=> $1::vector
LIMIT $2;
```

The route then reads current `incident_status`, summary, severity, and time from MySQL. The page links each result to its incident in the MySQL-backed incident list.

## Index and observed plan

`postgres/001_vector_schema.sql` creates an HNSW cosine index and a severity B-tree index. A local `EXPLAIN (ANALYZE, BUFFERS)` against the five seeded vector rows used `idx_incident_vectors_cosine` as an Index Scan ordered by cosine distance. PostgreSQL reported approximately 0.37 ms execution time for that tiny local sample. This timing is only a development observation, not a performance guarantee. The query plan grows with the data, model, hardware, and PostgreSQL statistics.

The full local workflow was exercised by the integration test: creating a test incident generated a real vector, a semantically similar query returned that incident with a score in `[0,1]`, and deleting the incident removed its vector through the outbox.

## Retry and diagnostics

```sh
# With Ollama running and nomic-embed-text pulled:
npm run db:sync-vectors

# Inspect pending and failed MySQL jobs:
mysql --protocol=tcp --host=127.0.0.1 --port=3307 --user=root \
  --database=fleet_logistics \
  --execute="SELECT state, operation, attempts, last_error FROM incident_vector_jobs ORDER BY id DESC LIMIT 20"

# Inspect vector rows:
psql --host=127.0.0.1 --port=5433 --username=postgres \
  --dbname=fleet_vectors --command="SELECT incident_id, severity, updated_at FROM incident_vectors ORDER BY updated_at DESC"
```

Typical causes are a stopped Ollama process, a missing model, a PostgreSQL connection mismatch, or incompatible embedding dimensions. Fix the local service/configuration, then rerun the sync. The source incident stays in MySQL regardless of vector availability.
