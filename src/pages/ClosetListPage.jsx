import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ClothesCardSkeleton, ActionSheet } from '../components/common';
import { mockClothes, categories } from '../mocks/data';
import { IoAdd } from 'react-icons/io5';
import './ClosetListPage.css';

const ClosetListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isLoading] = useState(false);
  const [showUploadSheet, setShowUploadSheet] = useState(false);

  // 카테고리별 필터링
  const filteredClothes = selectedCategory === 'ALL' 
    ? mockClothes 
    : mockClothes.filter(item => item.category === selectedCategory);

  // 옷 상세 페이지로 이동
  const handleClothesClick = (clothesId) => {
    navigate(`/closet/${clothesId}`);
  };

  // 옷 등록 방식 선택
  const handleUploadClick = () => {
    setShowUploadSheet(true);
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
        {categories.map(category => (
          <button
            key={category.id}
            className={`closet-list-page__category ${selectedCategory === category.id ? 'closet-list-page__category--active' : ''}`}
            onClick={() => setSelectedCategory(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* 옷 그리드 */}
      <div className="closet-list-page__content">
        {filteredClothes.length === 0 ? (
          <div className="closet-list-page__empty">
            <p>등록한 옷이 없습니다</p>
          </div>
        ) : (
          <div className="closet-list-page__grid">
            {isLoading ? (
              // 스켈레톤 로딩
              Array.from({ length: 12 }).map((_, index) => (
                <ClothesCardSkeleton key={index} />
              ))
            ) : (
              filteredClothes.map(item => (
                <div
                  key={item.id}
                  className="closet-list-page__item"
                  onClick={() => handleClothesClick(item.id)}
                >
                  <div className="closet-list-page__item-image">
                    {item.images[0] ? (
                      <img src={item.images[0]} alt={item.productName} />
                    ) : (
                      <div className="closet-list-page__item-placeholder">사진</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
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
