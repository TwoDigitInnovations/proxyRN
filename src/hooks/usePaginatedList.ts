import { useCallback, useEffect, useRef, useState } from 'react';

export function usePaginatedList<T>(fetchPage: (page: number, limit: number) => Promise<T[]>, limit = 10) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const load = useCallback(
    async (pageToLoad: number, replace: boolean) => {
      try {
        setError(null);
        const results = await fetchRef.current(pageToLoad, limit);
        setItems(prev => (replace ? results : [...prev, ...results]));
        setHasMore(results.length === limit);
        setPage(pageToLoad);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [limit],
  );

  useEffect(() => {
    setLoading(true);
    load(1, true);
  }, [load, fetchPage]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load(1, true);
  }, [load]);

  const loadMore = useCallback(() => {
    if (!loading && !refreshing && hasMore) {
      load(page + 1, false);
    }
  }, [loading, refreshing, hasMore, page, load]);

  return { items, loading, refreshing, hasMore, error, refresh, loadMore };
}
