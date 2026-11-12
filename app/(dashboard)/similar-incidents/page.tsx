import { SimilarIncidentSearch } from '@/frontend/components/similar-incidents';

export default function SimilarIncidentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">Intelligent Search</p>
        <h1 className="mt-1 text-3xl font-bold">Similar Incidents</h1>
        <p className="mt-2 text-sm text-slate-500">
          Find past operational issues and breakdowns by meaning and symptoms rather than exact keywords.
        </p>
      </div>

      <SimilarIncidentSearch />
    </div>
  );
}
