export function ScanReview() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6 bg-white dark:bg-gray-900">
        <p className="text-sm text-gray-500">No sessions to review.</p>
        <p className="text-2xl font-bold mt-1 text-gray-300 animate-pulse">—</p>
      </div>
      <p className="text-gray-500 text-sm">Loading scan & review data...</p>
    </div>
  );
}
