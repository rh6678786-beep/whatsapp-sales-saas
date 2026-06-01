import { useApiGet, useApiPost, useApiPatch } from './useApi';

export function useSessions(page = 1, pageSize = 20, state?: string) {
  const params = `page=${page}&pageSize=${pageSize}${state ? `&state=${state}` : ''}`;
  return useApiGet<any[]>(['sessions', String(page), state || 'all'], `/api/sessions?${params}`);
}

export function useBlockUser() {
  return useApiPost<any>('/api/sessions/block', { invalidateKeys: [['sessions']] });
}
