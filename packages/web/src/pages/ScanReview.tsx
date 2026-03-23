import { useState } from 'react';
import { useScan } from '@/hooks/useScan';
import { useImprovements, useUpdateImprovement, useApplyMutation, useDryRunMutation } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ScanSearch, CheckCircle, XCircle, Edit3, Play } from 'lucide-react';
import type { Improvement, DryRunResponse } from '@cll/shared';

type FilterStatus = 'all' | 'pending' | 'approved' | 'skipped';

const SEVERITY_COLORS: Record<string, 'destructive' | 'default' | 'secondary'> = {
  high: 'destructive',
  medium: 'default',
  low: 'secondary',
};

const CATEGORY_COLORS: Record<string, string> = {
  code_quality: 'bg-blue-100 text-blue-800',
  tool_usage: 'bg-purple-100 text-purple-800',
  factual_accuracy: 'bg-red-100 text-red-800',
  communication: 'bg-green-100 text-green-800',
  workflow: 'bg-orange-100 text-orange-800',
};

export function ScanReview() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResponse | null>(null);

  const { startScan, isScanning, progress } = useScan();
  const { data: improvementsData, isLoading } = useImprovements(
    filterStatus !== 'all' ? { status: filterStatus } : undefined,
  );
  const updateMutation = useUpdateImprovement();
  const applyMutation = useApplyMutation();
  const dryRunMutation = useDryRunMutation();

  const improvements: Improvement[] = improvementsData?.items ?? [];
  const approvedIds = improvements
    .filter(i => i.status === 'approved' || i.status === 'edited')
    .map(i => i.id);

  const handleApprove = (id: string) => {
    updateMutation.mutate({ id, data: { status: 'approved' } });
  };

  const handleSkip = (id: string) => {
    updateMutation.mutate({ id, data: { status: 'skipped' } });
  };

  const handleEditSave = (id: string) => {
    updateMutation.mutate({ id, data: { status: 'edited', editedRule: editText } });
    setEditingId(null);
  };

  const handleDryRun = async () => {
    if (approvedIds.length === 0) return;
    const result = await dryRunMutation.mutateAsync({ improvementIds: approvedIds });
    setDryRunResult(result as DryRunResponse);
    setShowApplyModal(true);
  };

  const handleApply = async () => {
    await applyMutation.mutateAsync({ improvementIds: approvedIds });
    setShowApplyModal(false);
    setDryRunResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Scan Trigger Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanSearch className="w-5 h-5" />
            Scan Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => startScan()}
              disabled={isScanning}
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              {isScanning ? 'Scanning...' : 'Start Scan'}
            </Button>
            {progress && (
              <span className="text-sm text-gray-600">
                Phase: <strong>{progress.phase}</strong>
              </span>
            )}
          </div>

          {/* Progress display */}
          {isScanning && progress && (
            <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
              {progress.phase === 'collect' && (
                <p className="text-sm text-gray-700">✓ Found {progress.total ?? 0} sessions</p>
              )}
              {progress.phase === 'detect' && (
                <p className="text-sm text-gray-700">
                  ✓ {progress.withCorrections ?? 0} with corrections, {progress.skipped ?? 0} skipped
                </p>
              )}
              {progress.phase === 'analyze' && (
                <p className="text-sm text-gray-700">⟳ Analyzing batch {progress.batch}...</p>
              )}
              {progress.phase === 'complete' && (
                <p className="text-sm text-green-700">
                  ✓ Complete! Found {progress.improvements ?? 0} improvements
                </p>
              )}
              <Progress
                value={
                  progress.phase === 'collect'
                    ? 25
                    : progress.phase === 'detect'
                      ? 50
                      : progress.phase === 'analyze'
                        ? 75
                        : 100
                }
                className="h-2"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Queue */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Review Queue</CardTitle>
          {/* Filter tabs */}
          <div className="flex gap-1">
            {(['all', 'pending', 'approved', 'skipped'] as FilterStatus[]).map(status => (
              <Button
                key={status}
                variant={filterStatus === status ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilterStatus(status)}
                className="capitalize text-xs"
              >
                {status}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : improvements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No improvements found.</p>
              <p className="text-sm mt-1">Run a scan to detect patterns from your sessions.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {improvements.map(imp => (
                <div key={imp.id} className="border rounded-lg p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[imp.category] ?? 'bg-gray-100 text-gray-800'}`}
                      >
                        {imp.category.replace('_', ' ')}
                      </span>
                      <Badge variant={SEVERITY_COLORS[imp.severity] ?? 'secondary'} className="text-xs">
                        {imp.severity}
                      </Badge>
                    </div>
                    <Badge
                      variant={imp.status === 'approved' || imp.status === 'edited' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {imp.status}
                    </Badge>
                  </div>

                  {/* What happened */}
                  <p className="text-sm text-gray-600">{imp.whatHappened}</p>

                  {/* User correction */}
                  {imp.userCorrection && (
                    <blockquote className="border-l-2 border-amber-400 pl-3 text-sm italic text-gray-600">
                      "{imp.userCorrection}"
                    </blockquote>
                  )}

                  {/* Suggested rule */}
                  {editingId === imp.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        className="w-full text-sm border rounded p-2 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleEditSave(imp.id)}>
                          Save & Approve
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-blue-50 rounded p-3 text-sm">
                      <p className="text-xs text-blue-600 font-medium mb-1">Suggested Rule</p>
                      <p>{imp.editedRule ?? imp.suggestedRule}</p>
                    </div>
                  )}

                  {/* Conflict warning */}
                  {imp.conflictWith && imp.conflictWith.length > 0 && (
                    <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                      ⚠ Conflicts with {imp.conflictWith.length} existing rule(s)
                    </p>
                  )}

                  {/* Actions */}
                  {imp.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(imp.id)}
                        disabled={updateMutation.isPending}
                        className="flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(imp.id);
                          setEditText(imp.suggestedRule);
                        }}
                        className="flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSkip(imp.id)}
                        disabled={updateMutation.isPending}
                        className="flex items-center gap-1 text-gray-500"
                      >
                        <XCircle className="w-3 h-3" />
                        Skip
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Apply Section */}
      {approvedIds.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm font-medium text-green-800">
              {approvedIds.length} improvement{approvedIds.length !== 1 ? 's' : ''} ready to apply
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDryRun}
                disabled={dryRunMutation.isPending}
              >
                Preview Changes
              </Button>
              <Button
                size="sm"
                onClick={() => handleApply()}
                disabled={applyMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Apply to CLAUDE.md
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dry-run diff modal */}
      <Dialog open={showApplyModal} onOpenChange={setShowApplyModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Changes</DialogTitle>
          </DialogHeader>

          {dryRunResult && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2 text-gray-500">
                  Changes ({dryRunResult.changes?.length ?? 0})
                </h4>
                <div className="space-y-1">
                  {(dryRunResult.changes ?? []).map((change, i) => (
                    <div key={i} className="text-sm flex items-start gap-2">
                      <span className="text-green-600 font-mono">+</span>
                      <span>{change.rule}</span>
                    </div>
                  ))}
                </div>
              </div>

              {dryRunResult.after && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-gray-500">Result Preview</h4>
                  <pre className="text-xs bg-gray-50 p-3 rounded border overflow-x-auto whitespace-pre-wrap">
                    {dryRunResult.after}
                  </pre>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={applyMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {applyMutation.isPending ? 'Applying...' : 'Confirm Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
