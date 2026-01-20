import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { Button, Spinner } from '../components/common';
import { useToast } from '../contexts/ToastContext';
import { mockSearchHistory, suggestedQueries, mockCoordinationResult } from '../mocks/data';
import { downloadImage } from '../utils/helpers';
import { IoHeart, IoHeartOutline, IoDownloadOutline, IoShareOutline } from 'react-icons/io5';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import './AICoordinationPage.css';

const AICoordinationPage = () => {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState(mockSearchHistory.slice(0, 3));
  const [result, setResult] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [likedImages, setLikedImages] = useState({});

  // 검색 실행
  const handleSearch = async (searchQuery = query) => {
    if (!searchQuery.trim()) {
      showError('검색어를 입력해주세요.');
      return;
    }

    setIsSearching(true);
    setResult(null);

    try {
      // API 연동 필요: AI 코디 추천 API 호출
      // const result = await getAICoordination(searchQuery);
      
      // 목업: AI 코디 결과 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setResult({
        ...mockCoordinationResult,
        userQuery: searchQuery,
      });

      // 검색 기록 업데이트
      setSearchHistory(prev => {
        const newHistory = [searchQuery, ...prev.filter(q => q !== searchQuery)];
        return newHistory.slice(0, 3);
      });

      setCurrentImageIndex(0);
    } catch (err) {
      showError('코디 추천에 실패했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  // 추천 문장 클릭
  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };

  // 이미지 네비게이션
  const handlePrevImage = () => {
    setCurrentImageIndex(prev => 
      prev === 0 ? result.images.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev => 
      prev === result.images.length - 1 ? 0 : prev + 1
    );
  };

  // 좋아요 토글
  const handleLike = (imageIndex) => {
    setLikedImages(prev => ({
      ...prev,
      [imageIndex]: !prev[imageIndex],
    }));
    
    if (!likedImages[imageIndex]) {
      success('좋아요를 눌렀습니다.');
    }
  };

  // 이미지 저장 (PNG)
  const handleSave = async (imageUrl) => {
    try {
      // API 연동 필요: 실제 이미지 URL로 다운로드
      // await downloadImage(imageUrl, `coordination_${Date.now()}.png`);
      
      // 목업: 저장 성공 시뮬레이션
      success('이미지가 저장되었습니다.');
    } catch (err) {
      showError('이미지 저장에 실패했습니다.');
    }
  };

  // 공유 (피드 생성으로 이동)
  const handleShare = (imageUrl) => {
    // 피드 생성 페이지로 이동하면서 이미지 전달
    navigate('/feed/create', { 
      state: { 
        presetImage: imageUrl,
        fromCoordination: true,
      } 
    });
  };

  return (
    <div className="ai-coordination-page">
      <Header title="AI 코디 추천" />

      <div className="ai-coordination-page__content">
        {/* 검색 입력 */}
        <div className="ai-coordination-page__search">
          <input
            type="text"
            className="ai-coordination-page__search-input"
            placeholder="어떤 상황에 입을 옷을 추천해드릴까요?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button 
            onClick={() => handleSearch()}
            loading={isSearching}
            disabled={!query.trim()}
          >
            검색
          </Button>
        </div>

        {/* 검색 전 화면 */}
        {!result && !isSearching && (
          <>
            {/* 검색 기록 */}
            {searchHistory.length > 0 && (
              <div className="ai-coordination-page__section">
                <h3 className="ai-coordination-page__section-title">나의 검색 기록</h3>
                <ul className="ai-coordination-page__history">
                  {searchHistory.map((item, index) => (
                    <li 
                      key={index}
                      className="ai-coordination-page__history-item"
                      onClick={() => handleSuggestionClick(item)}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 추천 검색어 */}
            <div className="ai-coordination-page__section">
              <h3 className="ai-coordination-page__section-title">이런 상황은 어때요?</h3>
              <ul className="ai-coordination-page__suggestions">
                {suggestedQueries.map((suggestion, index) => (
                  <li 
                    key={index}
                    className="ai-coordination-page__suggestion-item"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* 로딩 중 */}
        {isSearching && (
          <div className="ai-coordination-page__loading">
            <Spinner size="large" />
            <p>AI가 코디를 추천하고 있습니다...</p>
          </div>
        )}

        {/* 검색 결과 */}
        {result && !isSearching && (
          <div className="ai-coordination-page__result">
            {/* 코디 이미지 슬라이더 */}
            <div className="ai-coordination-page__image-section">
              <div className="ai-coordination-page__image-container">
                {result.images[currentImageIndex] ? (
                  <img 
                    src={result.images[currentImageIndex]} 
                    alt={`코디 ${currentImageIndex + 1}`}
                    className="ai-coordination-page__image"
                  />
                ) : (
                  <div className="ai-coordination-page__image-placeholder">
                    코디 이미지
                  </div>
                )}
                
                {result.images.length > 1 && (
                  <>
                    <button 
                      className="ai-coordination-page__image-nav ai-coordination-page__image-nav--prev"
                      onClick={handlePrevImage}
                    >
                      <IoChevronBack size={24} />
                    </button>
                    <button 
                      className="ai-coordination-page__image-nav ai-coordination-page__image-nav--next"
                      onClick={handleNextImage}
                    >
                      <IoChevronForward size={24} />
                    </button>
                  </>
                )}

                {/* 이미지 인디케이터 */}
                {result.images.length > 1 && (
                  <div className="ai-coordination-page__image-indicators">
                    {result.images.map((_, index) => (
                      <span 
                        key={index}
                        className={`ai-coordination-page__image-indicator ${
                          index === currentImageIndex ? 'ai-coordination-page__image-indicator--active' : ''
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* 액션 버튼들 */}
              <div className="ai-coordination-page__actions">
                <button 
                  className={`ai-coordination-page__action-btn ${likedImages[currentImageIndex] ? 'ai-coordination-page__action-btn--liked' : ''}`}
                  onClick={() => handleLike(currentImageIndex)}
                >
                  {likedImages[currentImageIndex] ? (
                    <IoHeart size={24} />
                  ) : (
                    <IoHeartOutline size={24} />
                  )}
                </button>
                <button 
                  className="ai-coordination-page__action-btn"
                  onClick={() => handleSave(result.images[currentImageIndex])}
                >
                  <IoDownloadOutline size={24} />
                </button>
                <button 
                  className="ai-coordination-page__action-btn"
                  onClick={() => handleShare(result.images[currentImageIndex])}
                >
                  <IoShareOutline size={24} />
                </button>
              </div>
            </div>

            {/* 코디 설명 */}
            <div className="ai-coordination-page__description">
              <p>{result.description}</p>
            </div>

            {/* 사용된 옷 아이템들 */}
            <div className="ai-coordination-page__clothes">
              <h3 className="ai-coordination-page__section-title">사용된 아이템</h3>
              <div className="ai-coordination-page__clothes-grid">
                {result.clothes.map((item, index) => (
                  <div key={index} className="ai-coordination-page__clothes-item">
                    <div className="ai-coordination-page__clothes-image">
                      {item.images?.[0] ? (
                        <img src={item.images[0]} alt={item.productName} />
                      ) : (
                        <div className="ai-coordination-page__clothes-placeholder">
                          사진
                        </div>
                      )}
                    </div>
                    <p className="ai-coordination-page__clothes-name">{item.productName}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AICoordinationPage;
