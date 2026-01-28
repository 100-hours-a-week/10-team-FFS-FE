import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ClothesCardSkeleton, ActionSheet } from '../components/common';
import { getMyClothes } from '../api';
import { IoAdd } from 'react-icons/io5';
import './ClosetListPage.css';

// 카테고리 목록 (API 명세에 맞게 수정)
const CATEGORIES = [
  { id: 'ALL', label: 'ALL' },
  { id: 'TOP', label: '상의' },
  { id: 'BOTTOM', label: '하의' },
  { id: 'DRESS', label: '원피스' },
  { id: 'SHOES', label: '신발' },
  { id: 'ACCESSORY', label: '악세사리' },
  { id: 'ETC', label: '기타' },
];

const ClosetListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { error: showError } = useToast();

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [clothes, setClothes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [showUploadSheet, setShowUploadSheet] = useState(false);

  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);

  // 옷 목록 조회
  const fetchClothes = useCallback(async (cursor = null, isLoadMore = false) => {
    if (!user?.id) {
      return;
    }

    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const category = selectedCategory === 'ALL' ? null : selectedCategory;
      const response = await getMyClothes(user.id, category, cursor);
      const { items, pageInfo } = response.data;
      if (isLoadMore) {
        setClothes(prev => [...prev, ...items]);
      } else {
        setClothes(items);
      }

      setHasMore(pageInfo.hasNextPage);
      setNextCursor(pageInfo.nextCursor);
    } catch (err) {
      showError('옷 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [user?.id, selectedCategory, showError]);

  // 초기 로드 및 카테고리 변경 시 다시 로드
  useEffect(() => {
    setClothes([]);
    setNextCursor(null);
    setHasMore(true);
    fetchClothes(null, false);
  }, [user?.id, selectedCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // 무한 스크롤 (IntersectionObserver)
  useEffect(() => {
    if (!loadMoreRef.current) {
      return;
    }

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore && nextCursor) {
          fetchClothes(nextCursor, true);
        }
      },
      { rootMargin: '100px' }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoading, isLoadingMore, nextCursor, fetchClothes]);

  // 옷 상세 페이지로 이동
  const handleClothesClick = (clothesId) => {
    navigate(`/closet/${clothesId}`);
  };

  // 옷 등록 방식 선택
  const handleUploadClick = () => {
    setShowUploadSheet(true);
  };

  // 카테고리 변경
  const handleCategoryChange = (categoryId) => {
    if (categoryId !== selectedCategory) {
      setSelectedCategory(categoryId);
    }
  };

  const uploadActions = [
    {
      label: '사진으로 업로드',
      onClick: () => navigate('/closet/upload'),
    },
    {
      label: '카메라로 업로드',
      onClick: () => navigate('/closet/upload?camera=true'),
    },
  ];

  return (
    <div className="closet-list-page">
      {/* 헤더 */}
      <div className="closet-list-page__header">
        <h1 className="closet-list-page__title">
          {user?.nickname || '00'} 님의 옷장
        </h1>
        <button
          className="closet-list-page__add-btn"
          onClick={handleUploadClick}
        >
          <IoAdd size={24} />
        </button>
      </div>

      {/* 카테고리 필터 */}
      <div className="closet-list-page__categories">
        {CATEGORIES.map(category => (
          <button
            key={category.id}
            className={`closet-list-page__category ${selectedCategory === category.id ? 'closet-list-page__category--active' : ''}`}
            onClick={() => handleCategoryChange(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* 옷 그리드 */}
      <div className="closet-list-page__content">
        {isLoading && clothes.length === 0 ? (
          // 초기 로딩 스켈레톤
          <div className="closet-list-page__grid">
            {Array.from({ length: 12 }).map((_, index) => (
              <ClothesCardSkeleton key={index} />
            ))}
          </div>
        ) : clothes.length === 0 ? (
          <div className="closet-list-page__empty">
            <p>등록한 옷이 없습니다</p>
          </div>
        ) : (
          <div className="closet-list-page__grid">
            {clothes.map(item => (
              <div
                key={item.clothesId}
                className="closet-list-page__item"
                onClick={() => handleClothesClick(item.clothesId)}
              >
                <div className="closet-list-page__item-image">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="옷" />
                  ) : (
                    <div className="closet-list-page__item-placeholder">사진</div>
                  )}
                </div>
              </div>
            ))}

            {/* 추가 로딩 스켈레톤 */}
            {isLoadingMore && (
              Array.from({ length: 6 }).map((_, index) => (
                <ClothesCardSkeleton key={`loading-${index}`} />
              ))
            )}
          </div>
        )}

        {/* 무한 스크롤 옵저버 타겟 */}
        {hasMore && <div ref={loadMoreRef} style={{ height: 1 }} />}
      </div>

      {/* 업로드 방식 선택 액션시트 */}
      <ActionSheet
        isOpen={showUploadSheet}
        onClose={() => setShowUploadSheet(false)}
        actions={uploadActions}
      />
    </div>
  );
};

export default ClosetListPage;
