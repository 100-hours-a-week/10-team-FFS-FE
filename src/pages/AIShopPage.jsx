import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { Spinner } from '../components/common';
import { createProductRecommendation, updateProductReaction } from '../api';
import {
  IoArrowDown,
  IoChevronBack,
  IoChevronForward,
  IoThumbsUp,
  IoThumbsUpOutline,
  IoThumbsDown,
  IoThumbsDownOutline,
  IoRefresh,
} from 'react-icons/io5';
import './AIShopPage.css';

// 가격 포맷 (숫자 3자리마다 콤마 + '₩')
const formatPrice = (price) => {
  return price.toLocaleString('ko-KR') + '₩';
};

const AIShopPage = () => {
  const navigate = useNavigate();

  // 진입 화면 상태
  const [query, setQuery] = useState('');

  // 결과/로딩/에러 상태
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [result, setResult] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reactions, setReactions] = useState({}); // { [feedbackId]: 'GOOD' | 'BAD' | 'NONE' }
  const [lastQuery, setLastQuery] = useState('');

  // 입력값 변경 (최대 100자 제한)
  const handleInputChange = (e) => {
    const value = e.target.value;
    if (value.length <= 100) {
      setQuery(value);
    }
  };

  // 검색 실행
  const handleSearch = useCallback(async (searchQuery = query) => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      return;
    }

    if (trimmedQuery.length < 2) {
      return;
    }

    setIsLoading(true);
    setIsError(false);
    setResult(null);
    setLastQuery(trimmedQuery);

    try {
      const response = await createProductRecommendation(trimmedQuery);
      const data = response.data;
      setResult({
        summary: data.outfitSummary,
        outfits: data.outfits || [],
      });
      setCurrentIndex(0);
      setReactions({});
    } catch (err) {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  // 캐러셀 네비게이션
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (result && currentIndex < result.outfits.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // 좋아요/싫어요 반응
  const handleReaction = async (type) => {
    if (!result || !result.outfits[currentIndex]) {
      return;
    }

    const outfit = result.outfits[currentIndex];
    const feedbackId = outfit.feedbackId;
    const currentReaction = reactions[feedbackId] || 'NONE';

    let newReaction;
    if (currentReaction === type) {
      newReaction = 'NONE';
    } else {
      newReaction = type;
    }

    setReactions(prev => ({
      ...prev,
      [feedbackId]: newReaction,
    }));

    try {
      await updateProductReaction(feedbackId, newReaction);
    } catch (err) {
      // 실패 시 이전 상태로 복구
      setReactions(prev => ({
        ...prev,
        [feedbackId]: currentReaction,
      }));
    }
  };

  // 상품 클릭 → 외부 쇼핑몰 이동
  const handleProductClick = (link) => {
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  };

  // 현재 코디 다시 추천받기
  const handleRetry = () => {
    if (lastQuery) {
      handleSearch(lastQuery);
    }
  };

  // 새로운 코디 추천받기 (진입 화면으로)
  const handleNewSearch = () => {
    setResult(null);
    setIsError(false);
    setQuery('');
    setLastQuery('');
    setCurrentIndex(0);
    setReactions({});
  };

  // 상품 카드 레이아웃 결정
  const getProductListClass = (count) => {
    if (count >= 5) {
      return 'ai-shop-page__product-grid';
    }
    return 'ai-shop-page__product-list';
  };

  // 탭 공통 렌더링
  const renderTabs = () => (
    <div className="ai-shop-page__tabs">
      <button
        className="ai-shop-page__tab"
        onClick={() => navigate('/ai-coordi')}
      >
        AI 추천 코디 받아보기
      </button>
      <button
        className="ai-shop-page__tab ai-shop-page__tab--active"
        disabled
      >
        AI 추천 상품 받아보기
      </button>
    </div>
  );

  // 로딩 화면
  if (isLoading) {
    return (
      <div className="ai-shop-page">
        <Header title="AI 쇼핑 추천" />
        <div className="ai-shop-page__content">
          {renderTabs()}
          <div className="ai-shop-page__loading">
            <Spinner size="large" />
            <p className="ai-shop-page__loading-text">상품을 추천하고 있어요...</p>
            <p className="ai-shop-page__loading-sub">약 10초 정도 소요될 수 있어요</p>
          </div>
        </div>
      </div>
    );
  }

  // 에러 화면
  if (isError) {
    return (
      <div className="ai-shop-page">
        <Header title="AI 쇼핑 추천" />
        <div className="ai-shop-page__content">
          {renderTabs()}
          <div className="ai-shop-page__error">
            <p className="ai-shop-page__error-message">
              추천에 실패했어요. 다시 시도해주세요.
            </p>
            <div className="ai-shop-page__error-actions">
              <button className="ai-shop-page__action-btn" onClick={handleRetry}>
                <IoRefresh size={18} />
                다시 시도할래요
              </button>
              <button className="ai-shop-page__action-btn" onClick={handleNewSearch}>
                새로운 코디를 추천받으시겠어요?
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 결과 화면
  if (result && result.outfits.length > 0) {
    const currentOutfit = result.outfits[currentIndex];
    const feedbackId = currentOutfit.feedbackId;
    const currentReaction = reactions[feedbackId] || 'NONE';
    const products = currentOutfit.products || [];

    return (
      <div className="ai-shop-page">
        <Header title="AI 쇼핑 추천" />
        <div className="ai-shop-page__content">
          {renderTabs()}

          {/* AI 생성 문구 */}
          <div className="ai-shop-page__summary">
            <p>{result.summary}</p>
          </div>

          {/* 상품 카드 */}
          <div className="ai-shop-page__card">
            {/* 캐러셀 */}
            <div className="ai-shop-page__carousel">
              <button
                className={`ai-shop-page__nav-btn${currentIndex === 0 ? ' ai-shop-page__nav-btn--disabled' : ''}`}
                onClick={handlePrev}
                disabled={currentIndex === 0}
                aria-label="이전 착장"
              >
                <IoChevronBack size={20} />
              </button>

              <div className="ai-shop-page__outfit-container">
                {/* 피드백 버튼 (카드 하단 좌측) */}
                <div className="ai-shop-page__feedback-btns">
                  <button
                    className={`ai-shop-page__feedback-btn${currentReaction === 'GOOD' ? ' ai-shop-page__feedback-btn--active' : ''}`}
                    onClick={() => handleReaction('GOOD')}
                    aria-label="좋아요"
                  >
                    {currentReaction === 'GOOD' ? <IoThumbsUp size={20} /> : <IoThumbsUpOutline size={20} />}
                  </button>
                  <button
                    className={`ai-shop-page__feedback-btn${currentReaction === 'BAD' ? ' ai-shop-page__feedback-btn--active' : ''}`}
                    onClick={() => handleReaction('BAD')}
                    aria-label="싫어요"
                  >
                    {currentReaction === 'BAD' ? <IoThumbsDown size={20} /> : <IoThumbsDownOutline size={20} />}
                  </button>
                </div>

                {/* 상품 목록 */}
                <div className={getProductListClass(products.length)}>
                  {products.slice(0, 8).map((product, idx) => (
                    <div
                      key={idx}
                      className="ai-shop-page__product-item"
                      onClick={() => handleProductClick(product.link)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleProductClick(product.link);
                        }
                      }}
                    >
                      <img
                        className="ai-shop-page__product-img"
                        src={product.imageUrl}
                        alt={product.name}
                      />
                      <div className="ai-shop-page__product-info">
                        <p className="ai-shop-page__product-name">{product.name}</p>
                        <p className="ai-shop-page__product-price">{formatPrice(product.price)}</p>
                        <p className="ai-shop-page__product-brand">{product.brandName || '-'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                className={`ai-shop-page__nav-btn${currentIndex === result.outfits.length - 1 ? ' ai-shop-page__nav-btn--disabled' : ''}`}
                onClick={handleNext}
                disabled={currentIndex === result.outfits.length - 1}
                aria-label="다음 착장"
              >
                <IoChevronForward size={20} />
              </button>
            </div>

            {/* 도트 인디케이터 */}
            {result.outfits.length > 1 && (
              <div className="ai-shop-page__indicators">
                {result.outfits.map((_, index) => (
                  <span
                    key={index}
                    className={`ai-shop-page__indicator${index === currentIndex ? ' ai-shop-page__indicator--active' : ''}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 하단 버튼 */}
          <div className="ai-shop-page__bottom-actions">
            <button className="ai-shop-page__action-btn" onClick={handleRetry}>
              <IoRefresh size={18} />
              현재 코디를 다시 추천받을래요
            </button>
            <button className="ai-shop-page__action-btn" onClick={handleNewSearch}>
              새로운 코디를 추천받으시겠어요?
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 진입 화면
  return (
    <div className="ai-shop-page">
      <Header title="AI 쇼핑 추천" />
      <div className="ai-shop-page__content">
        {renderTabs()}

        {/* 타이틀 */}
        <h2 className="ai-shop-page__title">원하는 스타일을 입력해보세요</h2>

        {/* 검색 입력 */}
        <div className="ai-shop-page__search">
          <div className="ai-shop-page__search-input-wrapper">
            <input
              type="text"
              className="ai-shop-page__search-input"
              placeholder="예) 캐주얼한 데일리룩 추천해줘"
              value={query}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              maxLength={100}
            />
            <button
              className="ai-shop-page__search-btn"
              onClick={() => handleSearch()}
              disabled={query.trim().length < 2}
              aria-label="검색"
            >
              <IoArrowDown size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIShopPage;
