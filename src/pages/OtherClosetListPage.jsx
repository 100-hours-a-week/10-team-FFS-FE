import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { ClothesCardSkeleton } from '../components/common';
import { useToast } from '../contexts/ToastContext';
import { mockUsers, getOtherUserClothes, categories } from '../mocks/data';
import './OtherClosetListPage.css';

const OtherClosetListPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { error: showError } = useToast();

  const [user, setUser] = useState(null);
  const [clothes, setClothes] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // API 연동 필요: 타인 옷장 조회
        // const userData = await getUserProfile(userId);
        // const clothesData = await getOtherUserClothes(userId);
        
        // 목업 데이터 사용
        const userData = mockUsers.find(u => u.id === userId);
        const clothesData = getOtherUserClothes(userId);
        
        if (userData) {
          setUser(userData);
          setClothes(clothesData);
        }
      } catch (err) {
        showError('옷장을 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [userId, showError]);

  // 카테고리별 필터링
  const filteredClothes = selectedCategory === 'ALL' 
    ? clothes 
    : clothes.filter(item => item.category === selectedCategory);

  // 옷 상세 페이지로 이동
  const handleClothesClick = (clothesId) => {
    navigate(`/profile/${userId}/closet/${clothesId}`);
  };

  if (!user) {
    return (
      <div className="other-closet-list-page">
        <Header showBack title="옷장" />
        <div className="other-closet-list-page__empty">
          <p>사용자를 찾을 수 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="other-closet-list-page">
      {/* 헤더 */}
      <Header showBack title={`${user.nickname} 님의 옷장`} />

      {/* 카테고리 필터 */}
      <div className="other-closet-list-page__categories">
        {categories.map(category => (
          <button
            key={category.id}
            className={`other-closet-list-page__category ${selectedCategory === category.id ? 'other-closet-list-page__category--active' : ''}`}
            onClick={() => setSelectedCategory(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* 옷 그리드 */}
      <div className="other-closet-list-page__content">
        {filteredClothes.length === 0 ? (
          <div className="other-closet-list-page__empty">
            <p>등록된 옷이 없습니다</p>
          </div>
        ) : (
          <div className="other-closet-list-page__grid">
            {isLoading ? (
              Array.from({ length: 12 }).map((_, index) => (
                <ClothesCardSkeleton key={index} />
              ))
            ) : (
              filteredClothes.map(item => (
                <div
                  key={item.id}
                  className="other-closet-list-page__item"
                  onClick={() => handleClothesClick(item.id)}
                >
                  <div className="other-closet-list-page__item-image">
                    {item.images[0] ? (
                      <img src={item.images[0]} alt={item.productName} />
                    ) : (
                      <div className="other-closet-list-page__item-placeholder">사진</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OtherClosetListPage;
