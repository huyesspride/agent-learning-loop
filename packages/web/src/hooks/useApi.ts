import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  DashboardData,
  PaginatedImprovements,
  ImprovementFilters,
  ApplyRequest,
  ApplyResponse,
  UpdateImprovementRequest,
} from '@cll/shared';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/dashboard'),
    refetchInterval: 60_000,
  });
}

export function useImprovements(filters?: ImprovementFilters) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.category) params.set('category', filters.category);
  if (filters?.severity) params.set('severity', filters.severity);

  const queryString = params.toString();
  return useQuery({
    queryKey: ['improvements', filters],
    queryFn: () =>
      api.get<PaginatedImprovements>(
        `/improvements${queryString ? `?${queryString}` : ''}`,
      ),
  });
}

export function useUpdateImprovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateImprovementRequest }) =>
      api.patch(`/improvements/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['improvements'] }),
  });
}

export function useApplyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ApplyRequest) => api.post<ApplyResponse>('/apply', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['improvements'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDryRunMutation() {
  return useMutation({
    mutationFn: (body: ApplyRequest) => api.post('/apply/dry-run', body),
  });
}

export function useRules(filters?: { category?: string; target?: string }) {
  const params = new URLSearchParams();
  if (filters?.category) params.set('category', filters.category);
  if (filters?.target) params.set('target', filters.target);

  const queryString = params.toString();
  return useQuery({
    queryKey: ['rules', filters],
    queryFn: () =>
      api.get<{ items: unknown[]; total: number }>(
        `/rules${queryString ? `?${queryString}` : ''}`,
      ),
  });
}

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => api.get('/config'),
  });
}

export function useRollbackSnapshots() {
  return useQuery({
    queryKey: ['rollback-snapshots'],
    queryFn: () => api.get('/rollback/snapshots'),
  });
}
