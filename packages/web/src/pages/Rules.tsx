import { useState } from 'react';
import { useRules } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { BookOpen, Plus, Archive, Zap } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface Rule {
  id: string;
  content: string;
  category?: string;
  target: string;
  effectiveness_score?: number;
  effectiveness_sample_count?: number;
  status: string;
}

export function Rules() {
  const { data, isLoading } = useRules();
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRuleText, setNewRuleText] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState('');
  const [showOptimizerModal, setShowOptimizerModal] = useState(false);
  const [optimizerRunning, setOptimizerRunning] = useState(false);
  const [optimizerResult, setOptimizerResult] = useState<any>(null);

  const rules: Rule[] = (data as any)?.items ?? [];

  // Context budget
  const totalWords = rules.reduce((sum, r) => sum + r.content.split(/\s+/).length, 0);
  const budgetPercent = Math.min(100, Math.round((totalWords / 1000) * 100));

  const handleAddRule = async () => {
    if (!newRuleText.trim()) return;
    await api.post('/rules', { content: newRuleText.trim(), category: newRuleCategory || undefined });
    qc.invalidateQueries({ queryKey: ['rules'] });
    setNewRuleText('');
    setNewRuleCategory('');
    setShowAddModal(false);
  };

  const handleRetire = async (id: string) => {
    if (!confirm('Retire this rule?')) return;
    await api.delete(`/rules/${id}`);
    qc.invalidateQueries({ queryKey: ['rules'] });
  };

  const handleRunOptimizer = async () => {
    setOptimizerRunning(true);
    setOptimizerResult(null);
    try {
      const result = await api.post('/optimize', {}) as any;
      setOptimizerResult(result);
    } catch (err) {
      setOptimizerResult({ error: String(err) });
    } finally {
      setOptimizerRunning(false);
      qc.invalidateQueries({ queryKey: ['rules'] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Context Budget */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Context Budget</span>
            <span className="text-sm text-gray-500">{totalWords} / 1000 words ({budgetPercent}%)</span>
          </div>
          <Progress value={budgetPercent} className="h-2" />
          <div className="flex items-center justify-between mt-3">
            <span className="text-sm text-gray-500">{rules.length} active rules</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowOptimizerModal(true)}
              disabled={optimizerRunning || rules.length === 0}
              className="flex items-center gap-2"
            >
              <Zap className="w-3 h-3" />
              {optimizerRunning ? 'Optimizing...' : 'Run Optimizer'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rules List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Active Rules
          </CardTitle>
          <Button size="sm" onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Rule
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No active rules yet.</p>
              <p className="text-sm mt-1">Apply improvements or add rules manually.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => {
                const score = rule.effectiveness_score;
                const samples = rule.effectiveness_sample_count ?? 0;
                const showScore = samples >= 5 && score !== undefined;

                return (
                  <div key={rule.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm flex-1">{rule.content}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRetire(rule.id)}
                        className="text-gray-400 hover:text-red-500 flex-shrink-0"
                      >
                        <Archive className="w-3 h-3" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {rule.category && (
                        <Badge variant="secondary" className="text-xs">{rule.category}</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">{rule.target}</Badge>
                    </div>

                    {/* Effectiveness */}
                    <div className="space-y-1">
                      {showScore ? (
                        <>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Effectiveness</span>
                            <span>{Math.round((score as number) * 100)}%</span>
                          </div>
                          <Progress value={Math.round((score as number) * 100)} className="h-1.5" />
                        </>
                      ) : (
                        <p className="text-xs text-gray-400">
                          {samples < 5 ? `Insufficient data (${samples} sessions)` : 'No effectiveness data'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Rule Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium">Rule text</label>
              <textarea
                value={newRuleText}
                onChange={e => setNewRuleText(e.target.value)}
                placeholder="Always verify factual claims before stating them..."
                className="w-full mt-1 text-sm border rounded p-2 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Category (optional)</label>
              <select
                value={newRuleCategory}
                onChange={e => setNewRuleCategory(e.target.value)}
                className="w-full mt-1 text-sm border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select category...</option>
                <option value="code_quality">Code Quality</option>
                <option value="tool_usage">Tool Usage</option>
                <option value="factual_accuracy">Factual Accuracy</option>
                <option value="communication">Communication</option>
                <option value="workflow">Workflow</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAddRule} disabled={!newRuleText.trim()}>Add Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Optimizer Result Modal */}
      <Dialog open={showOptimizerModal} onOpenChange={setShowOptimizerModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Optimizer</DialogTitle>
          </DialogHeader>
          {!optimizerResult ? (
            <div className="py-4 space-y-3">
              <p className="text-sm text-gray-600">
                The optimizer will analyze your rules and suggest merges, rewrites, and retirements to keep your CLAUDE.md concise and effective.
              </p>
              <Button
                onClick={handleRunOptimizer}
                disabled={optimizerRunning}
                className="w-full"
              >
                {optimizerRunning ? 'Running...' : 'Start Optimizer'}
              </Button>
            </div>
          ) : (
            <div className="py-2">
              {optimizerResult.error ? (
                <p className="text-sm text-red-600">Error: {optimizerResult.error}</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 p-3 rounded text-center">
                      <div className="text-lg font-bold text-green-600">{optimizerResult.merged ?? 0}</div>
                      <div className="text-xs text-gray-500">Merged</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded text-center">
                      <div className="text-lg font-bold text-blue-600">{optimizerResult.rewritten ?? 0}</div>
                      <div className="text-xs text-gray-500">Rewritten</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded text-center">
                      <div className="text-lg font-bold text-amber-600">{optimizerResult.retired ?? 0}</div>
                      <div className="text-xs text-gray-500">Retired</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded text-center">
                      <div className="text-lg font-bold text-gray-600">{optimizerResult.kept ?? 0}</div>
                      <div className="text-xs text-gray-500">Kept</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowOptimizerModal(false); setOptimizerResult(null); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
