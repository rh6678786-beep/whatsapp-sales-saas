import { useApiGet } from './useApi';

export function useOrders(page = 1, pageSize = 20) {
  return useApiGet<any[]>(['orders', String(page)], `/api/orders?page=${page}&pageSize=${pageSize}`);
}
