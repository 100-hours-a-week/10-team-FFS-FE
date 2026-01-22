import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { AlertModal, ActionSheet, Spinner } from '../components/common';
import { mockClothes } from '../mocks/data';
import { useToast } from '../contexts/ToastContext';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import { HiOutlineDotsHorizontal } from 'react-icons/hi';
import './ClosetDetailPage.css';

const ClosetDetailPage = () => {
  const { clothesId } = useParams();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  
  const [clothes, setClothes] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [setIsDeleting] = useState(false);

  // 옷 데이터 로드
  useEffect(() => {
    // API 연동 필요: 옷 상세 정보 조회
    const loadClothes = async () => {
      setIsLoading(true);
      try {
        // 목업 데이터 사용
        const found = mockClothes.find(item => item.id === clothesId);
        if (found) {
          setClothes(found);
        } else {
          showError('옷 정보를 찾을 수 없습니다.');
          navigate('/closet');
        }
      } catch (err) {
        showError('옷 정보를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadClothes();
  }, [clothesId, navigate, showError]);

  // 이미지 네비게이션
  const handlePrevImage = () => {
    setCurrentImageIndex(prev => 
      prev === 0 ? clothes.images.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev => 
      prev === clothes.images.length - 1 ? 0 : prev + 1
    );
  };

  // 옷 삭제
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // API 연동 필요: 옷 삭제 API 호출
      await new Promise(resolve => setTimeout(resolve, 1000));
      success('옷이 삭제되었습니다.');
      navigate('/closet');
    } catch (err) {
      showError('삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // 옷 수정
  const handleEdit = () => {
    navigate(`/closet/${clothesId}/edit`);
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
        rightAction={() => setShowActionSheet(true)}
        rightIcon={<HiOutlineDotsHorizontal size={24} />}
      />

      <div className="closet-detail-page__content">
        {/* 이미지 슬라이더 */}
        <div className="closet-detail-page__image-section">
          <div className="closet-detail-page__image-container">
            {clothes.images[0] ? (
              <img 
                src={clothes.images[currentImageIndex]} 
                alt={clothes.productName}
                className="closet-detail-page__image"
              />
            ) : (
              <div className="closet-detail-page__image-placeholder">
                이미지 없음
              </div>
            )}
            
            {clothes.images.length > 1 && (
              <>
                <button 
                  className="closet-detail-page__image-nav closet-detail-page__image-nav--prev"
                  onClick={handlePrevImage}
                >
                  <IoChevronBack size={24} />
                </button>
                <button 
                  className="closet-detail-page__image-nav closet-detail-page__image-nav--next"
                  onClick={handleNextImage}
                >
                  <IoChevronForward size={24} />
                </button>
                
                {/* 이미지 인디케이터 */}
                <div className="closet-detail-page__image-indicators">
                  {clothes.images.map((_, index) => (
                    <span 
                      key={index}
                      className={`closet-detail-page__image-indicator ${
                        index === currentImageIndex ? 'closet-detail-page__image-indicator--active' : ''
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 옷 정보 */}
        <div className="closet-detail-page__info">
          <div className="closet-detail-page__field">
            <label className="closet-detail-page__label">제품명</label>
            <p className="closet-detail-page__value">{clothes.productName}</p>
          </div>

          <div className="closet-detail-page__field">
            <label className="closet-detail-page__label">브랜드</label>
            <p className="closet-detail-page__value">{clothes.brand || '-'}</p>
          </div>

          <div className="closet-detail-page__field">
            <label className="closet-detail-page__label">가격</label>
            <p className="closet-detail-page__value">
              {clothes.price ? `${clothes.price}원` : '-'}
            </p>
          </div>

          <div className="closet-detail-page__field">
            <label className="closet-detail-page__label">사이즈</label>
            <p className="closet-detail-page__value">{clothes.size || '-'}</p>
          </div>

          <div className="closet-detail-page__field">
            <label className="closet-detail-page__label">구매 시기</label>
            <p className="closet-detail-page__value">
              {clothes.purchaseYear && clothes.purchaseMonth 
                ? `${clothes.purchaseYear}년 ${clothes.purchaseMonth}월`
                : '-'}
            </p>
          </div>

          <div className="closet-detail-page__field">
            <label className="closet-detail-page__label">카테고리</label>
            <p className="closet-detail-page__value">{clothes.category || '-'}</p>
          </div>

          <div className="closet-detail-page__field">
            <label className="closet-detail-page__label">소재</label>
            <div className="closet-detail-page__tags">
              {clothes.materials && clothes.materials.length > 0 ? (
                clothes.materials.map((material, index) => (
                  <span key={index} className="closet-detail-page__tag">
                    {material}
                  </span>
                ))
              ) : (
                <p className="closet-detail-page__value">-</p>
              )}
            </div>
          </div>

          <div className="closet-detail-page__field">
            <label className="closet-detail-page__label">색상</label>
            <div className="closet-detail-page__tags">
              {clothes.colors && clothes.colors.length > 0 ? (
                clothes.colors.map((color, index) => (
                  <span key={index} className="closet-detail-page__tag">
                    {color}
                  </span>
                ))
              ) : (
                <p className="closet-detail-page__value">-</p>
              )}
            </div>
          </div>

          <div className="closet-detail-page__field">
            <label className="closet-detail-page__label">스타일 태그</label>
            <div className="closet-detail-page__tags">
              {clothes.styleTags && clothes.styleTags.length > 0 ? (
                clothes.styleTags.map((tag, index) => (
                  <span key={index} className="closet-detail-page__tag closet-detail-page__tag--style">
                    {tag}
                  </span>
                ))
              ) : (
                <p className="closet-detail-page__value">-</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 액션 시트 */}
      <ActionSheet
        isOpen={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        actions={actions}
      />

      {/* 삭제 확인 모달 */}
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
