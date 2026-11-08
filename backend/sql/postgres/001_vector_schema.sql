CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS incident_vectors (
  incident_id BIGINT PRIMARY KEY,
  summary TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  embedding VECTOR(768) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_incident_vectors_cosine
  ON incident_vectors USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_incident_vectors_severity
  ON incident_vectors (severity);
