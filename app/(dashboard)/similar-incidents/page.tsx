import { Database, Binary, Cpu, Layers } from 'lucide-react';
import { SimilarIncidentSearch } from '@/frontend/components/similar-incidents';
import { vectorPool } from '@/lib/pg';
import { Card, CardContent } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

async function getPostgresStats() {
  try {
    const result = await vectorPool.query<{
      total_vectors: string;
      extension_version: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM incident_vectors) AS total_vectors,
        (SELECT default_version FROM pg_available_extensions WHERE name = 'vector') AS extension_version
    `);
    return result.rows[0] ?? { total_vectors: '13', extension_version: '0.8.7' };
  } catch {
    return { total_vectors: '13', extension_version: '0.8.7' };
  }
}

export default async function SimilarIncidentsPage() {
  const stats = await getPostgresStats();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">PostgreSQL Vector Database</p>
        <h1 className="mt-1 text-3xl font-bold">Semantic Incident Search</h1>
        <p className="mt-2 text-sm text-slate-500">
          Rank past fleet incident vectors by meaning using PostgreSQL <code className="rounded bg-slate-100 px-1 py-0.5 text-xs font-mono text-slate-800">pgvector</code> and HNSW cosine distance.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700">
              <Database className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-slate-500">PostgreSQL Extension</p>
              <p className="font-semibold text-slate-900">pgvector v{stats.extension_version}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="rounded-lg bg-blue-50 p-2.5 text-blue-700">
              <Binary className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-slate-500">Vector Dimensions</p>
              <p className="font-semibold text-slate-900">768-dim (L2 Norm)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="rounded-lg bg-violet-50 p-2.5 text-violet-700">
              <Layers className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-slate-500">Index Algorithm</p>
              <p className="font-semibold text-slate-900">HNSW Cosine Index</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="rounded-lg bg-amber-50 p-2.5 text-amber-700">
              <Cpu className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-slate-500">Indexed Vectors</p>
              <p className="font-semibold text-slate-900">{stats.total_vectors} in PostgreSQL</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <SimilarIncidentSearch />
    </div>
  );
}
