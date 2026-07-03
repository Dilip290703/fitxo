import ReportsClient from './ReportsClient';

export default function ReportsPage() {
  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-ink">Reports & Export</h2>
        <p className="text-sm text-muted">Download platform data as CSV</p>
      </div>
      <ReportsClient />
    </div>
  );
}
