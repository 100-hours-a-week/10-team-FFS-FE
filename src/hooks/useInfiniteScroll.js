import { useState, useEffect, useCallback, useRef } from 'react';

const useInfiniteScroll = (fetchData, options = {}) => {
  const { threshold = 200, initialLoad = true } = options;

  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  const cursorRef = useRef(null);
  const observerRef = useRef(null);

  // ✅ 중복 호출 방지용 refs
  const inFlightRef = useRef(false);
  const requestedCursorsRef = useRef(new Set());
  const initialLoadedRef = useRef(false);

  const loadMore = useCallback(async () => {
    // ✅ state 말고 ref로 가드 (동시 호출 레이스 방지)
    if (inFlightRef.current || !hasMore) return;

    const cursor = cursorRef.current;

    // ✅ 같은 cursor로 재호출 방지 (특히 초기 null 페이지 중복 방지)
    const cursorKey = cursor ?? '__NULL__';
    if (requestedCursorsRef.current.has(cursorKey)) return;

    inFlightRef.current = true;
    requestedCursorsRef.current.add(cursorKey);

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchData(cursor);

      if (Array.isArray(result.data) && result.data.length > 0) {
        setData(prev => {
          // ✅ (선택) id로 dedup: result.data에 id가 있다고 가정
          const map = new Map(prev.map(x => [x.id, x]));
          result.data.forEach(x => map.set(x.id, x));
          return Array.from(map.values());
        });

        cursorRef.current = result.nextCursor;
        setHasMore(result.hasMore !== false && result.nextCursor !== null);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      setError(err);
      console.error('Failed to load more data:', err);
      // 실패 시 같은 cursor 재시도 가능하게 해주고 싶으면 Set에서 제거
      requestedCursorsRef.current.delete(cursorKey);
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, [fetchData, hasMore]);

  // ✅ 초기 로드: StrictMode 2회 실행 방지
  useEffect(() => {
    if (!initialLoad) return;
    if (initialLoadedRef.current) return;
    initialLoadedRef.current = true;
    loadMore();
  }, [initialLoad, loadMore]);

  // ✅ IO 지원하면 scroll 폴백 끄기
  useEffect(() => {
    if ('IntersectionObserver' in window) return;

    const handleScroll = () => {
      if (inFlightRef.current || !hasMore) return;

      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;

      if (scrollTop + clientHeight >= scrollHeight - threshold) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, threshold, loadMore]);

  const reset = useCallback(() => {
    setData([]);
    cursorRef.current = null;
    setHasMore(true);
    setError(null);

    // ✅ 상태도 리셋
    requestedCursorsRef.current.clear();
    initialLoadedRef.current = false;
  }, []);

  const refresh = useCallback(async () => {
    reset();
    setTimeout(() => loadMore(), 0);
  }, [reset, loadMore]);

  const lastElementRef = useCallback((node) => {
    if (!('IntersectionObserver' in window)) return;
    if (inFlightRef.current) return;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore) {
          loadMore();
        }
      },
      { rootMargin: `${threshold}px` }
    );

    if (node) observerRef.current.observe(node);
  }, [hasMore, threshold, loadMore]);

  return { data, setData, isLoading, hasMore, error, loadMore, reset, refresh, lastElementRef };
};

export default useInfiniteScroll;
