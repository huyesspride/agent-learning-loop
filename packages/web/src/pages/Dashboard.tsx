export function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {['Sessions', 'Improvements', 'Active Rules', 'Correction Rate'].map(label => (
          <div key={label} className="rounded-lg border p-4 bg-white dark:bg-gray-900">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold mt-1 text-gray-300 animate-pulse">—</p>
          </div>
        ))}
      </div>
      <p className="text-gray-500 text-sm">Loading dashboard data...</p>
    </div>
  );
}
