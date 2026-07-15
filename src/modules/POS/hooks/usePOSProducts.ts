import { useDebounce } from '@renderer/hooks'
import { apiRequest } from '@renderer/lib/api'
import type { PaginatedResult } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'

export interface POSProduct {
  _id: string
  reference: string
  designation: string
  salePrice: number
  discount: number
  tva: number
  stock: number
}

export function usePOSProducts() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 200)
  const [selectedCategoryId, setSelectedCategoryId] = useState('')

  const isSearchMode = debouncedSearch.length > 0

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiRequest<Array<{ _id: string; name: string; prefix: string }>>('/categories'),
    staleTime: 60_000,
  })

  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ['pos-products-search', debouncedSearch],
    queryFn: () =>
      apiRequest<PaginatedResult<POSProduct>>(`/products?search=${debouncedSearch}&limit=30`),
    enabled: isSearchMode,
  })

  const { data: categoryProducts, isFetching: isLoadingCategory } = useQuery({
    queryKey: ['pos-products-category', selectedCategoryId],
    queryFn: () =>
      apiRequest<PaginatedResult<POSProduct>>(
        `/products?categoryId=${selectedCategoryId}&limit=200`
      ),
    enabled: !isSearchMode && !!selectedCategoryId,
    staleTime: 30_000,
  })

  const displayProducts = useMemo(() => {
    const items = (isSearchMode ? searchResults?.data : categoryProducts?.data) ?? []
    return items.filter((p) => p.stock > 0)
  }, [isSearchMode, searchResults?.data, categoryProducts?.data])

  const isLoading = isSearchMode ? isSearching : isLoadingCategory

  return {
    search,
    setSearch,
    debouncedSearch,
    isSearchMode,
    categories,
    selectedCategoryId,
    setSelectedCategoryId,
    displayProducts,
    isLoading,
  }
}