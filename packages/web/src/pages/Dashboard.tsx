import { useDashboard } from '@/hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { BarChart3, BookOpen, AlertCircle, TrendingDown } from 'lucide-react';

export function Dashboard() {
  const { data, isLoading, error } = useDashboard();
  const navigate = useNavigate();

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
        <AlertCircle className="w-5 h-5" />
        <span>Failed to load dashboard: {error.message}</span>
      </div>
    );
  }

  const stats = [
    {
      label: 'Sessions Analyzed',
      value: data?.analyzedSessions ?? '—',
      icon: BarChart3,
      sub: `${data?.totalSessions ?? 0} total`,
    },
    {
      label: 'Pending Improvements',
      value: data?.pendingImprovements ?? '—',
      icon: AlertCircle,
      badge: data?.pendingImprovements ? 'Review needed' : undefined,
    },
    {
      label: 'Active Rules',
      value: data?.appliedRules ?? '—',
      icon: BookOpen,
    },
    {
      label: 'Correction Rate',
      value: data ? `${(data.correctionRate * 100).toFixed(1)}%` : '—',
      icon: TrendingDown,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, sub, badge }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</CardTitle>
              <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{value}</div>
                  {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</p>}
                  {badge && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {badge}
                    </Badge>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : data?.recentRuns?.length ? (
            <div className="space-y-2">
              {data.recentRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={run.status === 'completed' ? 'default' : 'secondary'}
                    >
                      {run.runType}
                    </Badge>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {new Date(run.startedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{run.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
              No scans yet. Run your first scan to get started.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Button onClick={() => navigate('/scan')}>Start Scan</Button>
        <Button variant="outline" onClick={() => navigate('/scan')}>
          View Improvements
        </Button>
      </div>
    </div>
  );
}
