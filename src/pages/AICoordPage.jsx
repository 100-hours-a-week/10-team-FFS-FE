import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { Spinner, Button } from '../components/common';
import { useToast } from '../contexts/ToastContext';
import { createOutfitRecommendation, getOutfitHistories, updateOutfitReaction, getMyClothesCount } from '../api';
import { downloadImage } from '../utils/helpers';
import {
  IoArrowDown,
  IoChevronBack,
  IoChevronForward,
  IoDownloadOutline,
  IoThumbsUp,
  IoThumbsUpOutline,
  IoThumbsDown,
  IoThumbsDownOutline,
  IoRefresh,
  IoAddCircleOutline
} from 'react-icons/io5';
import './AICoordPage.css';

// 추천 문장 (고정)
const SUGGESTED_QUERIES = [
  '내일 결혼식장 갈건데 무슨 옷 입을까?',
  '지금 비온다',
  '어쩌고 저쩌고 이러쿵저러쿵'
];

const AICoordPage = () => {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  // 진입 화면 상태
  const [query, setQuery] = useState('');
  const [searchHistories, setSearchHistories] = useState([]);
  const [hasClothes, setHasClothes] = useState(true);
  const [isCheckingClothes, setIsCheckingClothes] = useState(true);

  // 결과 화면 상태
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [result, setResult] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reactions, setReactions] = useState({}); // { outfitId: 'GOOD' | 'BAD' | 'NONE' }
  const [lastQuery, setLastQuery] = useState('');

  // 옷장에 옷이 있는지 확인
  useEffect(() => {
    const checkClothes = async () => {
      try {
        const response = await getMyClothesCount();
        const count = response.data?.count ?? 0;
        setHasClothes(count > 0);
      } catch (err) {
        // 에러 시 옷이 있다고 가정 (API 실패 시 메인 기능은 동작하도록)
        setHasClothes(true);
      } finally {
        setIsCheckingClothes(false);
      }
    };
    checkClothes();
  }, []);

  // 검색 기록 조회
  useEffect(() => {
    const fetchHistories = async () => {
      try {
        const response = await getOutfitHistories();
        const histories = response.data?.requestHistories || [];
        setSearchHistories(histories.slice(0, 3));
      } catch (err) {
        // 검색 기록 조회 실패는 무시
      }
    };

    if (hasClothes && !result) {
      fetchHistories();
    }
  }, [hasClothes, result]);

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
      showError('검색어를 입력해주세요.');
      return;
    }

    if (trimmedQuery.length < 2) {
      showError('2자 이상 입력해주세요');
      return;
    }

    setIsLoading(true);
    setIsError(false);
    setResult(null);
    setLastQuery(trimmedQuery);

    try {
      const response = await createOutfitRecommendation(trimmedQuery);
      const data = response.data;

      setResult({
        summary: data.outfitSummary,
        outfits: data.outfits || []
      });
      setCurrentIndex(0);
      setReactions({});
    } catch (err) {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [query, showError]);

  // 추천 문장 또는 검색 기록 클릭
  const handleSuggestionClick = (text) => {
    setQuery(text);
    handleSearch(text);
  };

  // 옷장 이동
  const handleGoToCloset = () => {
    navigate('/closet');
  };

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

  // 이미지 다운로드
  const handleDownload = async () => {
    if (!result || !result.outfits[currentIndex]) {
      return;
    }

    const outfit = result.outfits[currentIndex];
    try {
      await downloadImage(outfit.outfitImageUrl, `coordination_${outfit.outfitId}.png`);
      success('이미지가 저장되었어요!');
    } catch (err) {
      showError('저장에 실패했어요. 다시 시도해주세요.');
    }
  };

  // 좋아요/싫어요 반응
  const handleReaction = async (type) => {
    if (!result || !result.outfits[currentIndex]) {
      return;
    }

    const outfit = result.outfits[currentIndex];
    const outfitId = outfit.outfitId;
    const currentReaction = reactions[outfitId] || 'NONE';

    // 토글 로직: 같은 버튼 다시 누르면 NONE으로
    let newReaction;
    if (currentReaction === type) {
      newReaction = 'NONE';
    } else {
      newReaction = type;
    }

    // 낙관적 업데이트
    setReactions(prev => ({
      ...prev,
      [outfitId]: newReaction
    }));

    try {
      await updateOutfitReaction(outfitId, newReaction);
    } catch (err) {
      // 실패 시 롤백
      setReactions(prev => ({
        ...prev,
        [outfitId]: currentReaction
      }));
    }
  };

  // 게시물에 올릴래요
  const handleShareToFeed = () => {
    if (!result || !result.outfits[currentIndex]) {
      return;
    }

    const outfit = result.outfits[currentIndex];
    navigate('/feed/create', {
      state: {
        presetImage: outfit.outfitImageUrl,
        fromCoordination: true
      }
    });
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

  // 로딩 중 체크
  if (isCheckingClothes) {
    return (
      <div className="ai-coord-page">
        <Header title="AI 코디 추천" />
        <div className="ai-coord-page__content">
          <div className="ai-coord-page__loading">
            <Spinner size="large" />
          </div>
        </div>
      </div>
    );
  }

  // 옷장이 비어있는 경우
  if (!hasClothes) {
    return (
      <div className="ai-coord-page">
        <Header title="AI 코디 추천" />
        <div className="ai-coord-page__content">
          <div className="ai-coord-page__empty-closet">
            <p className="ai-coord-page__empty-closet-message">
              옷장에 옷이 없습니다. 옷을 등록하세요
            </p>
            <Button onClick={handleGoToCloset} variant="secondary">
              옷장 이동하기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 로딩 중
  if (isLoading) {
    return (
      <div className="ai-coord-page">
        <Header title="AI 코디 추천" />
        <div className="ai-coord-page__content">
          <div className="ai-coord-page__loading">
            <Spinner size="large" />
            <p>코디를 추천하고 있어요...</p>
          </div>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (isError) {
    return (
      <div className="ai-coord-page">
        <Header title="AI 코디 추천" />
        <div className="ai-coord-page__content">
          <div className="ai-coord-page__error">
            <p className="ai-coord-page__error-message">
              추천에 실패했어요. 다시 시도해주세요.
            </p>
            <div className="ai-coord-page__error-actions">
              <Button onClick={handleRetry} variant="outline">
                다시 시도할래요
              </Button>
              <Button onClick={handleNewSearch} variant="outline">
                새로운 코디를 추천받으시겠어요?
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 결과 화면
  if (result && result.outfits.length > 0) {
    const currentOutfit = result.outfits[currentIndex];
    const currentReaction = reactions[currentOutfit.outfitId] || 'NONE';

    return (
      <div className="ai-coord-page">
        <Header title="AI 코디 추천" />
        <div className="ai-coord-page__content">
          {/* AI 변환 문구 */}
          <div className="ai-coord-page__summary">
            <p>{result.summary}</p>
          </div>

          {/* 코디 카드 */}
          <div className="ai-coord-page__card">
            {/* 다운로드 버튼 */}
            <button
              className="ai-coord-page__download-btn"
              onClick={handleDownload}
              aria-label="이미지 저장"
            >
              <IoDownloadOutline size={24} />
            </button>

            {/* 캐러셀 */}
            <div className="ai-coord-page__carousel">
              {/* 이전 버튼 */}
              <button
                className={`ai-coord-page__nav-btn ai-coord-page__nav-btn--prev ${currentIndex === 0 ? 'ai-coord-page__nav-btn--disabled' : ''}`}
                onClick={handlePrev}
                disabled={currentIndex === 0}
                aria-label="이전 코디"
              >
                <IoChevronBack size={24} />
              </button>

              {/* 이미지 */}
              <div className="ai-coord-page__image-container">
                {currentOutfit.outfitImageUrl ? (
                  <img
                    src={currentOutfit.outfitImageUrl}
                    alt={`코디 ${currentIndex + 1}`}
                    className="ai-coord-page__image"
                  />
                ) : (
                  <div className="ai-coord-page__image-placeholder">
                    AI 코디 추천<br />결과 사진
                  </div>
                )}
              </div>

              {/* 다음 버튼 */}
              <button
                className={`ai-coord-page__nav-btn ai-coord-page__nav-btn--next ${currentIndex === result.outfits.length - 1 ? 'ai-coord-page__nav-btn--disabled' : ''}`}
                onClick={handleNext}
                disabled={currentIndex === result.outfits.length - 1}
                aria-label="다음 코디"
              >
                <IoChevronForward size={24} />
              </button>
            </div>

            {/* 인디케이터 */}
            {result.outfits.length > 1 && (
              <div className="ai-coord-page__indicators">
                {result.outfits.map((_, index) => (
                  <span
                    key={index}
                    className={`ai-coord-page__indicator ${index === currentIndex ? 'ai-coord-page__indicator--active' : ''}`}
                  />
                ))}
              </div>
            )}

            {/* AI 코멘트 */}
            <div className="ai-coord-page__comment">
              <p>{currentOutfit.aiComment}</p>
            </div>

            {/* 액션 버튼 영역 */}
            <div className="ai-coord-page__actions">
              <div className="ai-coord-page__feedback-btns">
                <button
                  className={`ai-coord-page__feedback-btn ${currentReaction === 'GOOD' ? 'ai-coord-page__feedback-btn--active' : ''}`}
                  onClick={() => handleReaction('GOOD')}
                  aria-label="좋아요"
                >
                  {currentReaction === 'GOOD' ? <IoThumbsUp size={24} /> : <IoThumbsUpOutline size={24} />}
                </button>
                <button
                  className={`ai-coord-page__feedback-btn ${currentReaction === 'BAD' ? 'ai-coord-page__feedback-btn--active' : ''}`}
                  onClick={() => handleReaction('BAD')}
                  aria-label="싫어요"
                >
                  {currentReaction === 'BAD' ? <IoThumbsDown size={24} /> : <IoThumbsDownOutline size={24} />}
                </button>
              </div>
              <button
                className="ai-coord-page__share-btn"
                onClick={handleShareToFeed}
              >
                <IoAddCircleOutline size={20} />
                게시물에 올릴래요
              </button>
            </div>
          </div>

          {/* 하단 버튼 영역 */}
          <div className="ai-coord-page__bottom-actions">
            <button
              className="ai-coord-page__action-btn"
              onClick={handleRetry}
            >
              <IoRefresh size={20} />
              현재 코디 다시 추천받을래요
            </button>
            <button
              className="ai-coord-page__action-btn"
              onClick={handleNewSearch}
            >
              새로운 코디를 추천받으시겠어요?
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 진입 화면 (기본)
  return (
    <div className="ai-coord-page">
      <Header title="AI 코디 추천" />
      <div className="ai-coord-page__content">
        {/* 타이틀 */}
        <h2 className="ai-coord-page__title">TPO를 입력해보세요</h2>

        {/* 검색 입력 */}
        <div className="ai-coord-page__search">
          <div className="ai-coord-page__search-input-wrapper">
            <input
              type="text"
              className="ai-coord-page__search-input"
              placeholder=""
              value={query}
              onChange={handleInputChange}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              maxLength={100}
            />
            <button
              className="ai-coord-page__search-btn"
              onClick={() => handleSearch()}
              disabled={!query.trim()}
              aria-label="검색"
            >
              <IoArrowDown size={20} />
            </button>
          </div>
        </div>

        {/* 추천 문장 */}
        <div className="ai-coord-page__section">
          <h3 className="ai-coord-page__section-title">추천 문장</h3>
          <div className="ai-coord-page__suggestions">
            {SUGGESTED_QUERIES.map((suggestion, index) => (
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
        <div className="ai-coord-page__section ai-coord-page__section--right">
          <h3 className="ai-coord-page__section-title">나의 검색 기록</h3>
          {searchHistories.length > 0 ? (
            <div className="ai-coord-page__history">
              {searchHistories.map((item) => (
                <button
                  key={item.requestId}
                  className="ai-coord-page__history-item"
                  onClick={() => handleSuggestionClick(item.content)}
                >
                  {item.content}
                </button>
              ))}
            </div>
          ) : (
            <p className="ai-coord-page__history-empty">아직 검색 기록이 없습니다</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AICoordPage;