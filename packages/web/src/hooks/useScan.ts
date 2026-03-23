import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSSE } from './useSSE';
import { api } from '@/lib/api';
import type { ScanProgress, ScanRequest } from '@cll/shared';

export interface ScanState {
  isScanning: boolean;
  progress: ScanProgress | null;
  error: string | null;
  sseUrl: string | null;
}

export function useScan() {
  const qc = useQueryClient();
  const [state, setState] = useState<ScanState>({
    isScanning: false,
    progress: null,
    error: null,
    sseUrl: null,
  });

  const sseState = useSSE<ScanProgress>(state.sseUrl, state.isScanning);

  // Merge SSE data into scan state
  const progress = sseState.data ?? state.progress;
  const isComplete =
    progress?.phase === 'complete' || progress?.phase === 'error';

  // Handle scan completion via useEffect to avoid state updates during render
  useEffect(() => {
    if (isComplete && state.isScanning) {
      setState(s => ({ ...s, isScanning: false, sseUrl: null }));
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['improvements'] });
    }
  }, [isComplete, state.isScanning, qc]);

  const startScan = useCallback(async (request?: ScanRequest) => {
    setState(s => ({ ...s, isScanning: true, error: null, progress: null }));

    try {
      // Start scan via POST
      await api.post('/scan', request ?? {});

      // Connect to SSE for progress
      setState(s => ({ ...s, sseUrl: '/api/scan/status' }));
    } catch (err) {
      setState(s => ({
        ...s,
        isScanning: false,
        error: err instanceof Error ? err.message : 'Scan failed',
      }));
    }
  }, []);

  return {
    startScan,
    isScanning: state.isScanning,
    progress,
    error: state.error,
  };
}
