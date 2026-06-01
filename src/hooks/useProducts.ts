import { useApiGet, useApiPost, useApiPatch, useApiDelete } from './useApi';

export function useProducts(page = 1, pageSize = 20) {
  return useApiGet<any[]>(['products', String(page)], `/api/products?page=${page}&pageSize=${pageSize}`);
}

export function useProduct(id: string) {
  return useApiGet<any>(['product', id], `/api/products/${id}`, { enabled: !!id });
}

export function useCreateProduct() {
  return useApiPost<any>('/api/products', { invalidateKeys: [['products']] });
}

export function useUpdateProduct(id: string) {
  return useApiPatch<any>(`/api/products/${id}`, { invalidateKeys: [['products'], ['product', id]] });
}

export function useDeleteProduct() {
  return useApiDelete('/api/products', { invalidateKeys: [['products']] });
}
