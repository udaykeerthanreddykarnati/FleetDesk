import 'server-only';
import { Pool } from 'pg';

declare global {
  var fleetVectorPool: Pool | undefined;
}

export const vectorPool = globalThis.fleetVectorPool ?? new Pool({
  connectionString: process.env.PG_VECTOR_URL || 'postgresql://fleet_app:change_me@127.0.0.1:5432/fleet_vectors',
  max: 5,
  idleTimeoutMillis: 30000
});

if (process.env.NODE_ENV !== 'production') globalThis.fleetVectorPool = vectorPool;
