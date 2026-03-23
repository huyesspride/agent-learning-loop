import { useConfig, useRollbackSnapshots } from '@/hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { Settings2, RotateCcw, Shield } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export function Settings() {
  const { data: config, isLoading: configLoading } = useConfig();
  const { data: snapshots, isLoading: snapshotsLoading } = useRollbackSnapshots();
  const qc = useQueryClient();

  const handleRestore = async (backupId: number) => {
    if (!confirm(`Restore backup #${backupId}? This will overwrite your current CLAUDE.md.`)) return;
    try {
      await api.post('/rollback', { backupId });
      alert('Restored successfully!');
    } catch (err) {
      alert(`Failed to restore: ${err}`);
    }
  };

  // suppress unused variable warning
  void qc;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Config Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          {configLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : config ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-xs text-gray-500">Port</p>
                  <p className="font-mono font-medium">{(config as any).port}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-xs text-gray-500">Claude Model</p>
                  <p className="font-mono font-medium text-xs">{(config as any).claude?.model}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-xs text-gray-500">Max Session Age</p>
                  <p className="font-mono font-medium">{(config as any).scan?.maxSessionAge} days</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-xs text-gray-500">Heuristic Threshold</p>
                  <p className="font-mono font-medium">{(config as any).analysis?.heuristicThreshold}</p>
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-xs text-gray-500 mb-2">Privacy</p>
                <div className="flex gap-2">
                  {(config as any).privacy?.redactEmails && <Badge variant="secondary" className="text-xs">Redact Emails</Badge>}
                  {(config as any).privacy?.redactApiKeys && <Badge variant="secondary" className="text-xs">Redact API Keys</Badge>}
                  {(config as any).privacy?.redactPaths && <Badge variant="secondary" className="text-xs">Redact Paths</Badge>}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Config file: ~/.cll/config.yaml — edit manually to change settings
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Failed to load config</p>
          )}
        </CardContent>
      </Card>

      {/* Rollback Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Rollback
          </CardTitle>
        </CardHeader>
        <CardContent>
          {snapshotsLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (snapshots as any)?.items?.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              No backups yet. Backups are created automatically before applying improvements.
            </p>
          ) : (
            <div className="space-y-2">
              {((snapshots as any)?.items ?? []).map((backup: any) => (
                <div key={backup.id} className="flex items-center justify-between border rounded p-3">
                  <div>
                    <p className="text-sm font-medium">{backup.filePath?.split('/').pop() ?? 'CLAUDE.md'}</p>
                    <p className="text-xs text-gray-500">
                      {backup.backupType} · {backup.createdAt ? new Date(backup.createdAt).toLocaleString() : 'Unknown date'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRestore(backup.id)}
                    className="flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            About
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-1">
          <p>Claude Learning Loop v5</p>
          <p>Automatically learns from your Claude Code sessions.</p>
          <p className="text-xs text-gray-400 mt-2">
            Run <code className="bg-gray-100 px-1 rounded">cll doctor</code> from terminal to check system health.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
