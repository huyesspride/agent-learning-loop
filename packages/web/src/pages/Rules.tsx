import { useState } from 'react';
import { useRules } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { BookOpen, Plus, Archive, Zap, MessageSquare, Check, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface Rule {
  id: string;
  content: string;
  note?: string;
  category?: string;
  target: string;
  source?: 'cll' | 'manual';
  effectiveness_score?: number;
  effectiveness_sample_count?: number;
  status: string;
}

export function Rules() {
  const { data, isLoading } = useRules();
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRuleText, setNewRuleText] = useState('');
  const [newRuleNote, setNewRuleNote] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [showOptimizerModal, setShowOptimizerModal] = useState(false);
  const [optimizerRunning, setOptimizerRunning] = useState(false);
  const [optimizerResult, setOptimizerResult] = useState<any>(null);

  const rules: Rule[] = (data as any)?.items ?? [];

  // Context budget
  const totalWords = rules.reduce((sum, r) => sum + r.content.split(/\s+/).length, 0);
  const budgetPercent = Math.min(100, Math.round((totalWords / 1000) * 100));

  const handleAddRule = async () => {
    if (!newRuleText.trim()) return;
    await api.post('/rules', { content: newRuleText.trim(), note: newRuleNote.trim() || undefined, category: newRuleCategory || undefined });
    qc.invalidateQueries({ queryKey: ['rules'] });
    setNewRuleText('');
    setNewRuleNote('');
    setNewRuleCategory('');
    setShowAddModal(false);
  };

  const handleSaveNote = async (id: string) => {
    await api.patch(`/rules/${id}`, { note: editingNoteText.trim() || null });
    qc.invalidateQueries({ queryKey: ['rules'] });
    setEditingNoteId(null);
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
            <span className="text-sm text-gray-500 dark:text-gray-400">{totalWords} / 1000 words ({budgetPercent}%)</span>
          </div>
          <Progress value={budgetPercent} className="h-2" />
          <div className="flex items-center justify-between mt-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">{rules.length} active rules</span>
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
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
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

                const isManual = rule.source === 'manual';
                return (
                  <div key={rule.id} className={`border rounded-lg p-4 space-y-2 ${isManual ? 'border-blue-200 dark:border-blue-800/50 bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm flex-1">{rule.content}</p>
                      {!isManual && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRetire(rule.id)}
                          className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 flex-shrink-0"
                        >
                          <Archive className="w-3 h-3" />
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {isManual && (
                        <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0">Manual</Badge>
                      )}
                      {rule.category && (
                        <Badge variant="secondary" className="text-xs">{rule.category}</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">{rule.target}</Badge>
                    </div>

                    {/* Vietnamese Note — CLL rules only */}
                    {!isManual && editingNoteId === rule.id ? (
                      <div className="space-y-1.5">
                        <textarea
                          value={editingNoteText}
                          onChange={e => setEditingNoteText(e.target.value)}
                          placeholder="Ghi chú tiếng Việt..."
                          className="w-full text-sm border rounded p-2 h-16 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600 dark:placeholder-gray-500"
                          autoFocus
                        />
                        <div className="flex gap-1.5">
                          <Button size="sm" onClick={() => handleSaveNote(rule.id)} className="h-7 text-xs flex items-center gap-1">
                            <Check className="w-3 h-3" /> Lưu
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingNoteId(null)} className="h-7 text-xs flex items-center gap-1">
                            <X className="w-3 h-3" /> Huỷ
                          </Button>
                        </div>
                      </div>
                    ) : !isManual && rule.note ? (
                      <div
                        className="flex items-start gap-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded px-2.5 py-1.5 cursor-pointer group"
                        onClick={() => { setEditingNoteId(rule.id); setEditingNoteText(rule.note ?? ''); }}
                        title="Click để chỉnh sửa ghi chú"
                      >
                        <MessageSquare className="w-3 h-3 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-800 dark:text-amber-300 flex-1">{rule.note}</p>
                        <span className="text-xs text-amber-400 dark:text-amber-600 opacity-0 group-hover:opacity-100">✎</span>
                      </div>
                    ) : !isManual ? (
                      <button
                        onClick={() => { setEditingNoteId(rule.id); setEditingNoteText(''); }}
                        className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
                      >
                        <MessageSquare className="w-3 h-3" />
                        Thêm ghi chú tiếng Việt
                      </button>
                    ) : null}

                    {/* Effectiveness — CLL rules only */}
                    {!isManual && <div className="space-y-1">
                      {showScore ? (
                        <>
                          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>Effectiveness</span>
                            <span>{Math.round((score as number) * 100)}%</span>
                          </div>
                          <Progress value={Math.round((score as number) * 100)} className="h-1.5" />
                        </>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {samples < 5 ? `Insufficient data (${samples} sessions)` : 'No effectiveness data'}
                        </p>
                      )}
                    </div>}
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
                className="w-full mt-1 text-sm border rounded p-2 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600 dark:placeholder-gray-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                Ghi chú tiếng Việt <span className="text-gray-400 font-normal">(tuỳ chọn)</span>
              </label>
              <textarea
                value={newRuleNote}
                onChange={e => setNewRuleNote(e.target.value)}
                placeholder="Mô tả ngắn gọn ý nghĩa rule này bằng tiếng Việt..."
                className="w-full mt-1 text-sm border rounded p-2 h-16 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600 dark:placeholder-gray-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Category (optional)</label>
              <select
                value={newRuleCategory}
                onChange={e => setNewRuleCategory(e.target.value)}
                className="w-full mt-1 text-sm border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600"
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
              <p className="text-sm text-gray-600 dark:text-gray-300">
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
                <p className="text-sm text-red-600 dark:text-red-400">Error: {optimizerResult.error}</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-center">
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">{optimizerResult.merged ?? 0}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Merged</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-center">
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{optimizerResult.rewritten ?? 0}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Rewritten</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-center">
                      <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{optimizerResult.retired ?? 0}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Retired</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-center">
                      <div className="text-lg font-bold text-gray-600 dark:text-gray-300">{optimizerResult.kept ?? 0}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Kept</div>
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
