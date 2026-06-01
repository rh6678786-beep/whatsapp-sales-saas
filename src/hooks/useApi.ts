import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const api = axios;

export function useApiGet<T>(key: string[], url: string, options?: { enabled?: boolean }) {
  return useQuery<T>({
    queryKey: key,
    queryFn: () => api.get(url).then(r => r.data),
    ...options,
  });
}

export function useApiPost<TData = any, TResponse = any>(url: string, options?: { onSuccess?: (data: TResponse) => void; onError?: (err: any) => void; invalidateKeys?: string[][] }) {
  const queryClient = useQueryClient();
  return useMutation<TResponse, any, TData>({
    mutationFn: (data) => api.post(url, data).then(r => r.data),
    onSuccess: (data) => {
      options?.invalidateKeys?.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
}

export function useApiPatch<TData = any, TResponse = any>(url: string, options?: { onSuccess?: (data: TResponse) => void; onError?: (err: any) => void; invalidateKeys?: string[][] }) {
  const queryClient = useQueryClient();
  return useMutation<TResponse, any, TData>({
    mutationFn: (data) => api.patch(url, data).then(r => r.data),
    onSuccess: (data) => {
      options?.invalidateKeys?.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
}

export function useApiDelete<TResponse = any>(url: string, options?: { onSuccess?: () => void; onError?: (err: any) => void; invalidateKeys?: string[][] }) {
  const queryClient = useQueryClient();
  return useMutation<TResponse, any, void>({
    mutationFn: () => api.delete(url).then(r => r.data),
    onSuccess: () => {
      options?.invalidateKeys?.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
}
