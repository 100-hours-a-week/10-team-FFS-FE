import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 무한 스크롤 커스텀 훅
 * @param {Function} fetchData - 데이터를 가져오는 함수 (cursor를 인자로 받음)
 * @param {Object} options - 옵션
 * @param {number} options.threshold - 스크롤 트리거 지점 (하단에서 몇 px)
 * @param {boolean} options.initialLoad - 초기 로드 여부
 */
const useInfiniteScroll = (fetchData, options = {}) => {
  const { threshold = 200, initialLoad = true } = options;
  
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const cursorRef = useRef(null);
  const observerRef = useRef(null);

  // 데이터 로드 함수
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setError(null);

    try {
      // API 연동 필요: 실제 API에서 cursor 기반 페이지네이션
      const result = await fetchData(cursorRef.current);
      
      if (result.data && result.data.length > 0) {
        setData(prev => [...prev, ...result.data]);
        cursorRef.current = result.nextCursor;
        setHasMore(result.hasMore !== false && result.nextCursor !== null);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      setError(err);
      console.error('Failed to load more data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchData, isLoading, hasMore]);

  // 초기 로드
  useEffect(() => {
    if (initialLoad) {
      loadMore();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 스크롤 이벤트 핸들러 (IntersectionObserver 미지원 시 폴백)
  useEffect(() => {
    const handleScroll = () => {
      if (isLoading || !hasMore) return;

      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;

      // 하단 threshold px 전에 미리 로드
      if (scrollTop + clientHeight >= scrollHeight - threshold) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoading, hasMore, threshold, loadMore]);

  // 리셋 함수
  const reset = useCallback(() => {
    setData([]);
    cursorRef.current = null;
    setHasMore(true);
    setError(null);
  }, []);

  // 리셋 후 다시 로드
  const refresh = useCallback(async () => {
    reset();
    // 다음 틱에서 로드
    setTimeout(() => loadMore(), 0);
  }, [reset, loadMore]);

  // IntersectionObserver를 위한 sentinel ref 콜백
  const lastElementRef = useCallback((node) => {
    if (isLoading) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    }, {
      rootMargin: `${threshold}px`,
    });

    if (node) {
      observerRef.current.observe(node);
    }
  }, [isLoading, hasMore, threshold, loadMore]);

  return {
    data,
    setData,
    isLoading,
    hasMore,
    error,
    loadMore,
    reset,
    refresh,
    lastElementRef,
  };
};

export default useInfiniteScroll;
