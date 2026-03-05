import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { AlertModal, ActionSheet, Spinner } from '../components/common';
import { getClothesDetail, deleteClothes, getClothesFeeds } from '../api';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import { useToast } from '../contexts/ToastContext';
import { HiOutlineDotsHorizontal } from 'react-icons/hi';
import FeedList from './FeedList';
import './ClosetDetailPage.css';

const CATEGORY_LABELS = {
  TOP: '상의',
  BOTTOM: '하의',
  DRESS: '원피스',
  SHOES: '신발',
  ACCESSORY: '악세사리',
  ETC: '기타',
};

const ClosetDetailPage = () => {
  const { clothesId } = useParams();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const [clothes, setClothes] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 옷 데이터 로드
  useEffect(() => {
    const loadClothes = async () => {
      setIsLoading(true);
      try {
        const response = await getClothesDetail(clothesId);
        if (response.code === 200) {
          setClothes(response.data);
        } else {
          showError('옷 정보를 찾을 수 없습니다.');
          navigate(-1);
        }
      } catch (err) {
        console.error('Failed to load clothes:', err);
        showError('옷 정보를 불러오는데 실패했습니다.');
        navigate(-1);
      } finally {
        setIsLoading(false);
      }
    };

    loadClothes();
  }, [clothesId, navigate, showError]);

  // 태그된 피드 - FeedListPage와 동일한 패턴
  const fetchTaggedFeeds = useCallback(async (cursor) => {
    const response = await getClothesFeeds(clothesId, cursor, 12);
    const { items, pageInfo } = response.data;

    return {
      data: items.map((item) => ({
        id: item.feedId,
        primaryImageUrl: item.primaryImageUrl,
        likeCount: item.likeCount,
        commentCount: item.commentCount,
        author: {
          id: item.userProfile.userId,
          profileImage: item.userProfile.userProfileImageUrl,
          nickname: item.userProfile.nickname,
        },
        isLiked: item.isLiked,
      })),
      nextCursor: pageInfo.hasNextPage ? pageInfo.nextCursor : null,
      hasMore: pageInfo.hasNextPage,
    };
  }, [clothesId]);

  const taggedFeeds = useInfiniteScroll(fetchTaggedFeeds, { threshold: 300 });

  const formatBoughtDate = (boughtDate) => {
    if (!boughtDate) return '-';
    const date = new Date(boughtDate);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
  };

  const formatPrice = (price) => {
    if (!price) return '-';
    return `${price.toLocaleString()}원`;
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteClothes(clothesId);
      success('옷이 삭제되었습니다.');
      navigate('/closet');
    } catch (err) {
      console.error('Delete failed:', err);
      showError('삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleEdit = () => {
    navigate(`/clothes/${clothesId}/edit`);
  };

  const actions = [
    { label: '수정', onClick: handleEdit },
    { label: '삭제', onClick: () => setShowDeleteModal(true), danger: true },
  ];

  if (isLoading) {
    return (
      <div className="closet-detail-page">
        <Header showBack title="옷 상세" />
        <div className="closet-detail-page__loading">
          <Spinner size="large" />
        </div>
      </div>
    );
  }

  if (!clothes) {
    return null;
  }

  return (
    <div className="closet-detail-page">
      <Header
        showBack
        title="옷 상세"
        rightAction={clothes.isOwner ? () => setShowActionSheet(true) : undefined}
        rightIcon={clothes.isOwner ? <HiOutlineDotsHorizontal size={24} /> : undefined}
      />

      <div className="closet-detail-page__content">
        {/* 이미지 */}
        <div className="closet-detail-page__image-section">
          <div className="closet-detail-page__image-container">
            {clothes.clothesImageUrl ? (
              <img
                src={clothes.clothesImageUrl}
                alt={clothes.name}
                className="closet-detail-page__image"
              />
            ) : (
              <div className="closet-detail-page__image-placeholder">
                이미지 없음
              </div>
            )}
          </div>
        </div>

        {/* 옷 정보 */}
        <div className="closet-detail-page__info">
          <div className="closet-detail-page__field">
            <label className="closet-detail-page__label">제품명</label>
            <p className="closet-detail-page__value">{clothes.name || '-'}</p>
          </div>

          <div className="closet-detail-page__field">
            <label className="closet-detail-page__label">브랜드</label>
            <p className="closet-detail-page__value">{clothes.brand || '-'}</p>
          </div>

          <div className="closet-detail-page__field">
            <label className="closet-detail-page__label">가격</label>
            <p className="closet-detail-page__value">{formatPrice(clothes.price)}</p>
          </div>

          <div className="closet-detail-page__field">
            <label className="closet-detail-page__label">사이즈</label>
            <p className="closet-detail-page__value">{clothes.size || '-'}</p>
          </div>

          <div className="closet-detail-page__field">
            <label className="closet-detail-page__label">구매 시기</label>
            <p className="closet-detail-page__value">{formatBoughtDate(clothes.boughtDate)}</p>
          </div>

          <div className="closet-detail-page__field">
            <label className="closet-detail-page__label">카테고리</label>
            <p className="closet-detail-page__value">
              {CATEGORY_LABELS[clothes.category] || clothes.category || '-'}
            </p>
          </div>

          <div className="closet-detail-page__field">
            <label className="closet-detail-page__label">소재</label>
            <div className="closet-detail-page__tags">
              {clothes.material && clothes.material.length > 0 ? (
                clothes.material.map((item, index) => (
                  <span key={index} className="closet-detail-page__tag">{item}</span>
                ))
              ) : (
                <p className="closet-detail-page__value">-</p>
              )}
            </div>
          </div>

          <div className="closet-detail-page__field">
            <label className="closet-detail-page__label">색상</label>
            <div className="closet-detail-page__tags">
              {clothes.color && clothes.color.length > 0 ? (
                clothes.color.map((item, index) => (
                  <span key={index} className="closet-detail-page__tag">{item}</span>
                ))
              ) : (
                <p className="closet-detail-page__value">-</p>
              )}
            </div>
          </div>

          <div className="closet-detail-page__field">
            <label className="closet-detail-page__label">스타일 태그</label>
            <div className="closet-detail-page__tags">
              {clothes.styleTag && clothes.styleTag.length > 0 ? (
                clothes.styleTag.map((tag, index) => (
                  <span key={index} className="closet-detail-page__tag closet-detail-page__tag--style">
                    #{tag}
                  </span>
                ))
              ) : (
                <p className="closet-detail-page__value">-</p>
              )}
            </div>
          </div>
        </div>

        {/* 구분선 */}
        <div className="closet-detail-page__divider" />

        {/* 태그된 피드 섹션 */}
        <div className="closet-detail-page__feeds-section">
          <div className="closet-detail-page__feeds-header">
            <h3 className="closet-detail-page__feeds-title">태그된 피드</h3>
          </div>

          {taggedFeeds.data.length === 0 && !taggedFeeds.isLoading ? (
            <div className="closet-detail-page__feeds-empty">
              <p className="closet-detail-page__feeds-empty-text">
                이 옷이 태그된 피드가 없습니다.
              </p>
            </div>
          ) : (
            <FeedList
              feeds={taggedFeeds.data}
              isLoading={taggedFeeds.isLoading}
              lastElementRef={taggedFeeds.lastElementRef}
              onFeedClick={(feedId) => navigate(`/feed/${feedId}`)}
            />
          )}
        </div>
      </div>

      <ActionSheet
        isOpen={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        actions={actions}
      />

      <AlertModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="옷 삭제"
        message="이 옷을 삭제하시겠습니까?"
        confirmText="삭제"
        cancelText="취소"
        onConfirm={handleDelete}
        danger
      />
    </div>
  );
};

export default ClosetDetailPage;