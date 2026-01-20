import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Header } from '../components/layout';
import { Spinner } from '../components/common';
import { useToast } from '../contexts/ToastContext';
import { mockClothes } from '../mocks/data';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import './OtherClosetDetailPage.css';

const OtherClosetDetailPage = () => {
  const { userId, clothesId } = useParams();
  const { error: showError } = useToast();
  
  const [clothes, setClothes] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // 데이터 로드
  useEffect(() => {
    const loadClothes = async () => {
      setIsLoading(true);
      try {
        // API 연동 필요: 타인 옷 상세 조회
        // const data = await getOtherUserClothesDetail(userId, clothesId);
        
        // 목업 데이터 사용 (실제 clothesId에서 원본 ID 추출)
        const originalId = clothesId.includes('_') 
          ? clothesId.split('_').slice(1).join('_') 
          : clothesId;
        const data = mockClothes.find(item => item.id === originalId || item.id === clothesId);
        
        if (data) {
          setClothes(data);
        }
      } catch (err) {
        showError('데이터를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadClothes();
  }, [userId, clothesId, showError]);

  // 이미지 네비게이션
  const handlePrevImage = () => {
    setCurrentImageIndex(prev => 
      prev > 0 ? prev - 1 : clothes.images.length - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev => 
      prev < clothes.images.length - 1 ? prev + 1 : 0
    );
  };

  if (isLoading) {
    return (
      <div className="other-closet-detail-page">
        <Header showBack title="옷 상세" />
        <div className="other-closet-detail-page__loading">
          <Spinner size="large" />
        </div>
      </div>
    );
  }

  if (!clothes) {
    return (
      <div className="other-closet-detail-page">
        <Header showBack title="옷 상세" />
        <div className="other-closet-detail-page__empty">
          <p>옷을 찾을 수 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="other-closet-detail-page">
      <Header showBack title="옷 상세" />

      {/* 이미지 슬라이더 */}
      <div className="other-closet-detail-page__image-section">
        <div className="other-closet-detail-page__image">
          {clothes.images[currentImageIndex] ? (
            <img src={clothes.images[currentImageIndex]} alt={clothes.productName} />
          ) : (
            <div className="other-closet-detail-page__image-placeholder">사진</div>
          )}
        </div>
        
        {clothes.images.length > 1 && (
          <>
            <button className="other-closet-detail-page__nav other-closet-detail-page__nav--prev" onClick={handlePrevImage}>
              <IoChevronBack size={24} />
            </button>
            <button className="other-closet-detail-page__nav other-closet-detail-page__nav--next" onClick={handleNextImage}>
              <IoChevronForward size={24} />
            </button>
            <div className="other-closet-detail-page__dots">
              {clothes.images.map((_, index) => (
                <span 
                  key={index} 
                  className={`other-closet-detail-page__dot ${index === currentImageIndex ? 'other-closet-detail-page__dot--active' : ''}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* 상세 정보 (읽기 전용) */}
      <div className="other-closet-detail-page__info">
        <div className="other-closet-detail-page__field">
          <label className="other-closet-detail-page__label">상품명</label>
          <p className="other-closet-detail-page__value">{clothes.productName}</p>
        </div>

        <div className="other-closet-detail-page__field">
          <label className="other-closet-detail-page__label">브랜드</label>
          <p className="other-closet-detail-page__value">{clothes.brand || '-'}</p>
        </div>

        <div className="other-closet-detail-page__field">
          <label className="other-closet-detail-page__label">가격</label>
          <p className="other-closet-detail-page__value">{clothes.price ? `${clothes.price}원` : '-'}</p>
        </div>

        <div className="other-closet-detail-page__field">
          <label className="other-closet-detail-page__label">사이즈</label>
          <p className="other-closet-detail-page__value">{clothes.size || '-'}</p>
        </div>

        <div className="other-closet-detail-page__field">
          <label className="other-closet-detail-page__label">구매일</label>
          <p className="other-closet-detail-page__value">
            {clothes.purchaseYear}년 {clothes.purchaseMonth}월
          </p>
        </div>

        <div className="other-closet-detail-page__field">
          <label className="other-closet-detail-page__label">카테고리</label>
          <p className="other-closet-detail-page__value">{clothes.category}</p>
        </div>

        <div className="other-closet-detail-page__field">
          <label className="other-closet-detail-page__label">소재</label>
          <div className="other-closet-detail-page__tags">
            {clothes.materials.map((material, index) => (
              <span key={index} className="other-closet-detail-page__tag">{material}</span>
            ))}
          </div>
        </div>

        <div className="other-closet-detail-page__field">
          <label className="other-closet-detail-page__label">색상</label>
          <div className="other-closet-detail-page__tags">
            {clothes.colors.map((color, index) => (
              <span key={index} className="other-closet-detail-page__tag">{color}</span>
            ))}
          </div>
        </div>

        <div className="other-closet-detail-page__field">
          <label className="other-closet-detail-page__label">스타일 태그</label>
          <div className="other-closet-detail-page__tags">
            {clothes.styleTags.map((tag, index) => (
              <span key={index} className="other-closet-detail-page__tag other-closet-detail-page__tag--style">{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OtherClosetDetailPage;
