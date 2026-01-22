import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { Spinner } from '../components/common';
import { useToast } from '../contexts/ToastContext';
import { mockSearchHistory, mockCoordinationResult, suggestedQueries } from '../mocks/data';
import { downloadImage } from '../utils/helpers';
import { IoHeart, IoHeartOutline, IoDownloadOutline, IoShareOutline, IoSend } from 'react-icons/io5';
import { MdHistory } from 'react-icons/md';
import './AICoordPage.css';

const AICoordPage = () => {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [likedImages, setLikedImages] = useState({});

  // 검색 실행
  const handleSearch = async (searchQuery = query) => {
    if (!searchQuery.trim()) {
      showError('검색어를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // API 연동 필요: AI 코디 추천 요청
      // const data = await getAICoordination(searchQuery);
      
      // 목업: AI 코디 결과 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setResult({
        ...mockCoordinationResult,
        userQuery: searchQuery,
      });
    } catch (err) {
      showError('코디 추천에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 추천 검색어 클릭
  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };

  // 검색 기록 클릭
  const handleHistoryClick = (historyItem) => {
    setQuery(historyItem);
    handleSearch(historyItem);
  };

  // 좋아요 토글
  const handleLike = async (imageIndex) => {
    // API 연동 필요: 좋아요 API
    setLikedImages(prev => ({
      ...prev,
      [imageIndex]: !prev[imageIndex]
    }));
    
    if (!likedImages[imageIndex]) {
      success('좋아요를 눌렀습니다');
    }
  };

  // 이미지 저장
  const handleSave = async (imageUrl, index) => {
    try {
      // 실제로는 imageUrl을 사용해서 다운로드
      // 목업에서는 가상으로 처리
      await downloadImage(imageUrl, `coordination_${index + 1}.png`);
      success('이미지가 저장되었습니다');
    } catch (err) {
      // 목업이므로 성공으로 처리
      success('이미지가 저장되었습니다');
    }
  };

  // 공유 (피드 생성으로 이동)
  const handleShare = (imageUrl) => {
    // 피드 생성 페이지로 이동하면서 이미지 전달
    navigate('/feed/create', { 
      state: { 
        presetImage: imageUrl,
        fromCoordination: true 
      } 
    });
  };

  return (
    <div className="ai-coord-page">
      <Header title="AI 코디 추천" />

      <div className="ai-coord-page__content">
        {/* 검색 입력 */}
        <div className="ai-coord-page__search">
          <div className="ai-coord-page__search-input-wrapper">
            <input
              type="text"
              className="ai-coord-page__search-input"
              placeholder="어떤 스타일을 찾으시나요?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button 
              className="ai-coord-page__search-btn"
              onClick={() => handleSearch()}
              disabled={isLoading}
            >
              <IoSend size={20} />
            </button>
          </div>
        </div>

        {/* 로딩 상태 */}
        {isLoading && (
          <div className="ai-coord-page__loading">
            <Spinner size="large" />
            <p>AI가 코디를 추천하고 있습니다...</p>
          </div>
        )}

        {/* 결과가 없을 때: 추천 검색어 & 검색 기록 */}
        {!isLoading && !result && (
          <>
            {/* 추천 검색어 */}
            <div className="ai-coord-page__section">
              <h3 className="ai-coord-page__section-title">추천 검색어</h3>
              <div className="ai-coord-page__suggestions">
                {suggestedQueries.map((suggestion, index) => (
                  <button
                    key={index}
                    className="ai-coord-page__suggestion"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* 나의 검색 기록 */}
            <div className="ai-coord-page__section">
              <h3 className="ai-coord-page__section-title">
                <MdHistory size={18} />
                나의 검색 기록
              </h3>
              <div className="ai-coord-page__history">
                {mockSearchHistory.slice(0, 3).map((item, index) => (
                  <button
                    key={index}
                    className="ai-coord-page__history-item"
                    onClick={() => handleHistoryClick(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 코디 결과 */}
        {!isLoading && result && (
          <div className="ai-coord-page__result">
            {/* AI 설명 */}
            <div className="ai-coord-page__result-description">
              <p>{result.description}</p>
            </div>

            {/* 코디 이미지들 */}
            <div className="ai-coord-page__result-images">
              {result.images.map((imageUrl, index) => (
                <div key={index} className="ai-coord-page__result-card">
                  <div className="ai-coord-page__result-image">
                    {imageUrl ? (
                      <img src={imageUrl} alt={`코디 ${index + 1}`} />
                    ) : (
                      <div className="ai-coord-page__result-placeholder">
                        코디 이미지 {index + 1}
                      </div>
                    )}
                  </div>
                  
                  {/* 액션 버튼들 */}
                  <div className="ai-coord-page__result-actions">
                    <button 
                      className={`ai-coord-page__action-btn ${likedImages[index] ? 'ai-coord-page__action-btn--liked' : ''}`}
                      onClick={() => handleLike(index)}
                    >
                      {likedImages[index] ? <IoHeart size={24} /> : <IoHeartOutline size={24} />}
                    </button>
                    <button 
                      className="ai-coord-page__action-btn"
                      onClick={() => handleSave(imageUrl, index)}
                    >
                      <IoDownloadOutline size={24} />
                    </button>
                    <button 
                      className="ai-coord-page__action-btn"
                      onClick={() => handleShare(imageUrl)}
                    >
                      <IoShareOutline size={24} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 사용된 옷 목록 */}
            <div className="ai-coord-page__used-clothes">
              <h4 className="ai-coord-page__used-clothes-title">사용된 옷</h4>
              <div className="ai-coord-page__used-clothes-list">
                {result.clothes.map((item, index) => (
                  <div key={index} className="ai-coord-page__used-clothes-item">
                    <div className="ai-coord-page__used-clothes-image">
                      {item.images?.[0] ? (
                        <img src={item.images[0]} alt={item.productName} />
                      ) : (
                        <div className="ai-coord-page__used-clothes-placeholder">
                          {item.position}
                        </div>
                      )}
                    </div>
                    <span className="ai-coord-page__used-clothes-name">
                      {item.productName}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 다시 검색 버튼 */}
            <button 
              className="ai-coord-page__retry-btn"
              onClick={() => setResult(null)}
            >
              다른 코디 찾기
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AICoordPage;
