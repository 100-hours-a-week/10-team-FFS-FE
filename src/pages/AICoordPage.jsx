import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { Spinner, Button } from '../components/common';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { getOutfitSessions, createOutfitRequestV2, getMyClothesCount } from '../api';
import { IoArrowUp } from 'react-icons/io5';
import './AICoordPage.css';

// 상대 시간 포맷
const formatRelativeTime = (dateStr) => {
  if (!dateStr) {
    return '';
  }
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) {
    return '방금 전';
  }
  if (diffMin < 60) {
    return `${diffMin}분 전`;
  }
  if (diffHour < 24) {
    return `${diffHour}시간 전`;
  }
  if (diffDay < 7) {
    return `${diffDay}일 전`;
  }
  return date.toLocaleDateString('ko-KR');
};

// 탭 컴포넌트 (공통)
const AiTabs = ({ activeTab, onTabChange }) => (
  <div className="ai-coord-page__tabs">
    <button
      className={`ai-coord-page__tab${activeTab === 'coordi' ? ' ai-coord-page__tab--active' : ''}`}
      onClick={() => { if (activeTab !== 'coordi') { onTabChange('coordi'); } }}
      disabled={activeTab === 'coordi'}
    >
      AI 추천 코디 받아보기
    </button>
    <button
      className={`ai-coord-page__tab${activeTab === 'shop' ? ' ai-coord-page__tab--active' : ''}`}
      onClick={() => { if (activeTab !== 'shop') { onTabChange('shop'); } }}
      disabled={activeTab === 'shop'}
    >
      AI 추천 상품 받아보기
    </button>
  </div>
);

const AICoordPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { error: showError } = useToast();

  // 상태
  const [query, setQuery] = useState('');
  const [hasClothes, setHasClothes] = useState(true);
  const [isCheckingClothes, setIsCheckingClothes] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [page, setPage] = useState(0);
  const [isLastPage, setIsLastPage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 옷장에 옷이 있는지 확인
  useEffect(() => {
    const checkClothes = async () => {
      try {
        const response = await getMyClothesCount();
        const count = response.data?.count ?? 0;
        setHasClothes(count > 0);
      } catch (err) {
        setHasClothes(true);
      } finally {
        setIsCheckingClothes(false);
      }
    };
    checkClothes();
  }, []);

  // 세션 목록 조회
  const fetchSessions = useCallback(async (pageNum = 0, append = false) => {
    setIsLoadingSessions(true);
    try {
      const response = await getOutfitSessions(pageNum, 10);
      const data = response.data;
      const content = data?.content || [];
      if (append) {
        setSessions(prev => [...prev, ...content]);
      } else {
        setSessions(content);
      }
      setIsLastPage(data?.last ?? true);
      setPage(pageNum);
    } catch (err) {
      console.error('세션 목록 조회 실패:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    if (hasClothes && !isCheckingClothes) {
      fetchSessions(0);
    }
  }, [hasClothes, isCheckingClothes, fetchSessions]);

  // 더 불러오기
  const handleLoadMore = () => {
    if (!isLastPage && !isLoadingSessions) {
      fetchSessions(page + 1, true);
    }
  };

  // 입력값 변경 (최대 100자)
  const handleInputChange = (e) => {
    const value = e.target.value;
    if (value.length <= 100) {
      setQuery(value);
    }
  };

  // 새 세션 생성 (입력 제출)
  const handleSubmit = useCallback(async () => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      showError('검색어를 입력해주세요.');
      return;
    }

    if (trimmedQuery.length < 2) {
      showError('2자 이상 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await createOutfitRequestV2(trimmedQuery);
      const { sessionId } = response.data;
      navigate(`/ai-coordi/${sessionId}`, {
        state: { initialQuery: trimmedQuery },
      });
    } catch (err) {
      showError(err.message || '코디 요청에 실패했어요.');
    } finally {
      setIsSubmitting(false);
    }
  }, [query, showError, navigate]);

  // 세션 클릭
  const handleSessionClick = (sessionId) => {
    navigate(`/ai-coordi/${sessionId}`);
  };

  // 옷장 이동
  const handleGoToCloset = () => {
    navigate(`/closet/${user?.id}`);
  };

  // 탭 전환
  const handleTabChange = (tab) => {
    if (tab === 'shop') {
      navigate('/ai-shop');
    }
  };

  // 로딩 중 체크
  if (isCheckingClothes) {
    return (
      <div className="ai-coord-page">
        <Header title="AI 코디 추천" />
        <div className="ai-coord-page__content">
          <AiTabs activeTab="coordi" onTabChange={handleTabChange} />
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
          <AiTabs activeTab="coordi" onTabChange={handleTabChange} />
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

  return (
    <div className="ai-coord-page">
      <Header title="AI 코디 추천" />
      <div className="ai-coord-page__content">
        <AiTabs activeTab="coordi" onTabChange={handleTabChange} />

        {/* 입력창 */}
        <div className="ai-coord-page__search">
          <div className="ai-coord-page__search-input-wrapper">
            <input
              type="text"
              className="ai-coord-page__search-input"
              placeholder="예) 면접룩 추천해줘"
              value={query}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSubmitting) {
                  handleSubmit();
                }
              }}
              maxLength={100}
              disabled={isSubmitting}
            />
            <button
              className="ai-coord-page__search-btn"
              onClick={handleSubmit}
              disabled={!query.trim() || isSubmitting}
              aria-label="전송"
            >
              {isSubmitting ? <Spinner size="small" /> : <IoArrowUp size={20} />}
            </button>
          </div>
        </div>

        {/* 세션 목록 */}
        <div className="ai-coord-page__session-list">
          {sessions.length === 0 && !isLoadingSessions && (
            <p className="ai-coord-page__session-empty">
              아직 대화 기록이 없어요. 위 입력창에 원하는 코디를 입력해보세요!
            </p>
          )}

          {sessions.map((session) => (
            <button
              key={session.sessionId}
              className="ai-coord-page__session-item"
              onClick={() => handleSessionClick(session.sessionId)}
            >
              <span className="ai-coord-page__session-title">
                {session.title || '코디 추천'}
              </span>
              <span className="ai-coord-page__session-time">
                {formatRelativeTime(session.updatedAt || session.createdAt)}
              </span>
            </button>
          ))}

          {/* 더 불러오기 */}
          {!isLastPage && sessions.length > 0 && (
            <button
              className="ai-coord-page__load-more"
              onClick={handleLoadMore}
              disabled={isLoadingSessions}
            >
              {isLoadingSessions ? <Spinner size="small" /> : '더 보기'}
            </button>
          )}

          {isLoadingSessions && sessions.length === 0 && (
            <div className="ai-coord-page__loading">
              <Spinner size="large" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AICoordPage;
