import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { Spinner } from '../components/common';
import { useToast } from '../contexts/ToastContext';
import { useChatContext } from '../contexts/ChatContext';
import {
  getOutfitSessionDetail,
  createOutfitRequestV2,
  updateOutfitReactionV2,
  getOutfitResultClothes,
} from '../api';
import {
  IoArrowUp,
  IoThumbsUp,
  IoThumbsUpOutline,
  IoThumbsDown,
  IoThumbsDownOutline,
  IoChevronBack,
  IoChevronForward,
  IoClose,
} from 'react-icons/io5';
import './OutfitChatPage.css';

// 시간 포맷: 오전/오후 H:MM
const formatMessageTime = (timeStr) => {
  if (!timeStr) {
    return '';
  }
  const date = new Date(timeStr);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours < 12 ? '오전' : '오후';
  const h = hours % 12 || 12;
  return `${ampm} ${h}:${minutes}`;
};

// 서버 turn 데이터를 메시지 배열로 변환
const turnsToMessages = (turns) => {
  const messages = [];
  if (!turns || !Array.isArray(turns)) {
    return messages;
  }

  turns.forEach((turn) => {
    // 사용자 메시지 — API 응답 필드: requestText
    messages.push({
      type: 'user',
      content: turn.requestText || '',
      createdAt: turn.createdAt,
      turnNo: turn.turnNo,
    });

    // AI 응답
    if (turn.status === 'SUCCESS' || turn.status === 'COMPLETED') {
      messages.push({
        type: 'ai',
        content: turn.querySummary || '',
        outfits: turn.outfits || [],
        createdAt: turn.completedAt || turn.createdAt,
        turnNo: turn.turnNo,
      });
    } else if (turn.status === 'CLARIFICATION_NEEDED') {
      messages.push({
        type: 'ai',
        content: turn.querySummary || '질문을 좀 더 구체적으로 해주세요.',
        outfits: [],
        createdAt: turn.completedAt || turn.createdAt,
        turnNo: turn.turnNo,
        isClarification: true,
      });
    } else if (turn.status === 'FAILED') {
      messages.push({
        type: 'ai',
        content: '코디 추천에 실패했어요. 다시 시도해주세요.',
        outfits: [],
        createdAt: turn.completedAt || turn.createdAt,
        turnNo: turn.turnNo,
        isFailed: true,
      });
    } else if (turn.status === 'PENDING' || turn.status === 'PROCESSING') {
      messages.push({
        type: 'ai-loading',
        stepLabel: turn.stepLabel || '처리 중...',
        turnNo: turn.turnNo,
      });
    }
  });

  return messages;
};

// 코디 카드 컴포넌트
const OutfitCard = ({ outfit, index, total, reaction, isReactable, onImageClick }) => {
  return (
    <div className="outfit-chat__card">
      <div
        className="outfit-chat__card-image-wrap outfit-chat__card-image-wrap--clickable"
        onClick={onImageClick}
      >
        {outfit.vtonImageUrl ? (
          <img
            src={outfit.vtonImageUrl}
            alt={`코디 ${index + 1}`}
            className="outfit-chat__card-image"
          />
        ) : (
          <div className="outfit-chat__card-image-placeholder">이미지 준비 중</div>
        )}
        {reaction && reaction !== 'NONE' && (
          <span className="outfit-chat__card-reaction-badge">
            {reaction === 'GOOD' ? '👍' : '👎'}
          </span>
        )}
        <span className="outfit-chat__card-tap-hint">
          {isReactable ? '탭하여 평가' : '탭하여 상세보기'}
        </span>
      </div>
      <div className="outfit-chat__card-info">
        <span className="outfit-chat__card-label">코디 {index + 1}/{total}</span>
        {outfit.clothesIds && outfit.clothesIds.length > 0 && (
          <span className="outfit-chat__card-clothes-count">옷 {outfit.clothesIds.length}개</span>
        )}
      </div>
    </div>
  );
};

const OutfitChatPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { error: showError } = useToast();
  const {
    setOutfitEventHandler,
    clearOutfitEventHandler,
    stompConnected,
  } = useChatContext();

  const initialQuery = location.state?.initialQuery || null;

  // 상태
  const [sessionTitle, setSessionTitle] = useState('AI 코디 추천');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reactions, setReactions] = useState({}); // { [resultId]: 'GOOD' | 'BAD' | 'NONE' }

  // 리뷰 모달 상태
  const [reviewModal, setReviewModal] = useState({
    open: false,
    outfits: [],
    index: 0,
    isReactable: false,
  });

  // 옷 상세 정보 캐시: { [resultId]: clothes[] }
  const [clothesCache, setClothesCache] = useState({});
  const [clothesLoading, setClothesLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const hasInitialQuery = useRef(!!initialQuery);

  // 가장 최근 완료된 AI 메시지의 인덱스 (리액션 가능 대상)
  // turnNo 대신 배열 인덱스 기반으로 판단 — WebSocket 이벤트에 turnNo가 없어도 동작
  const latestReactableMsgIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === 'ai' && messages[i].outfits?.length > 0) {
        return i;
      }
    }
    return -1;
  }, [messages]);

  // 하단 자동 스크롤
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }, []);

  // 옷 상세 정보 조회 헬퍼
  const fetchClothesForOutfits = useCallback(async (outfits) => {
    const resultIds = outfits
      .map((o) => o.resultId)
      .filter((id) => id && !clothesCache[id]);
    if (resultIds.length === 0) {
      return;
    }

    try {
      setClothesLoading(true);
      const res = await getOutfitResultClothes(resultIds);
      const results = res.data?.results || [];
      const newCache = {};
      results.forEach((r) => {
        newCache[r.resultId] = r.clothes;
      });
      setClothesCache((prev) => ({ ...prev, ...newCache }));
    } catch (err) {
      console.error('옷 상세 조회 실패:', err);
    } finally {
      setClothesLoading(false);
    }
  }, [clothesCache]);

  // 리뷰 모달 열기/닫기/네비게이션
  const openReviewModal = useCallback((outfits, startIndex, isReactable) => {
    setReviewModal({ open: true, outfits, index: startIndex, isReactable });
    fetchClothesForOutfits(outfits);
  }, [fetchClothesForOutfits]);

  const closeReviewModal = useCallback(() => {
    setReviewModal({ open: false, outfits: [], index: 0, isReactable: false });
  }, []);

  const reviewPrev = useCallback(() => {
    setReviewModal((prev) => ({ ...prev, index: Math.max(0, prev.index - 1) }));
  }, []);

  const reviewNext = useCallback(() => {
    setReviewModal((prev) => ({
      ...prev,
      index: Math.min(prev.outfits.length - 1, prev.index + 1),
    }));
  }, []);

  // 세션 상세 로드
  useEffect(() => {
    const loadSession = async () => {
      setIsLoading(true);
      try {
        const response = await getOutfitSessionDetail(sessionId, 0, 50);
        const data = response.data;
        setSessionTitle(data?.title || '코디 추천');

        const turns = data?.turns || [];
        // turns가 역순(최신 먼저)이면 뒤집기
        const orderedTurns =
          turns.length > 1 && turns[0]?.turnNo > turns[turns.length - 1]?.turnNo
            ? [...turns].reverse()
            : turns;
        const converted = turnsToMessages(orderedTurns);
        setMessages(converted);

        // 기존 리액션 복구
        const existingReactions = {};
        orderedTurns.forEach((turn) => {
          if (turn.outfits) {
            turn.outfits.forEach((outfit) => {
              if (outfit.resultId && outfit.reaction && outfit.reaction !== 'NONE') {
                existingReactions[outfit.resultId] = outfit.reaction;
              }
            });
          }
        });
        setReactions(existingReactions);
      } catch (err) {
        // 새 세션 생성 직후 아직 데이터 없는 경우
        if (hasInitialQuery.current && initialQuery) {
          setMessages([
            {
              type: 'user',
              content: initialQuery,
              createdAt: new Date().toISOString(),
              turnNo: 1,
            },
            {
              type: 'ai-loading',
              stepLabel: '코디를 찾고 있어요...',
              turnNo: 1,
            },
          ]);
          setSessionTitle(initialQuery);
        } else {
          console.error('세션 상세 조회 실패:', err);
        }
      } finally {
        setIsLoading(false);
        hasInitialQuery.current = false;
      }
    };

    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // 로드 완료 후 하단 스크롤
  useEffect(() => {
    if (!isLoading) {
      scrollToBottom();
    }
  }, [isLoading, scrollToBottom]);

  // WebSocket 이벤트 핸들러 등록
  useEffect(() => {
    if (!stompConnected) {
      return;
    }

    const handleOutfitEvent = (event) => {
      // 이 세션의 이벤트만 처리
      if (String(event.sessionId) !== String(sessionId)) {
        return;
      }

      const { status, stepLabel } = event;

      if (status === 'PROCESSING' || status === 'processing') {
        setMessages((prev) => {
          const lastIdx = prev.length - 1;
          if (lastIdx >= 0 && prev[lastIdx].type === 'ai-loading') {
            const updated = [...prev];
            updated[lastIdx] = { ...updated[lastIdx], stepLabel: stepLabel || '처리 중...' };
            return updated;
          }
          return prev;
        });
      } else if (status === 'SUCCESS' || status === 'success' || status === 'COMPLETED') {
        const outfits = event.outfits || [];
        setMessages((prev) => {
          const updated = prev.filter((m) => m.type !== 'ai-loading');
          updated.push({
            type: 'ai',
            content: event.querySummary || event.aiMessage || '',
            outfits,
            createdAt: event.completedAt || new Date().toISOString(),
            turnNo: event.turnNo,
          });
          return updated;
        });
        setIsSubmitting(false);
        scrollToBottom();

        // 옷 상세 정보 미리 캐싱
        if (outfits.length > 0) {
          const resultIds = outfits.map((o) => o.resultId).filter(Boolean);
          if (resultIds.length > 0) {
            getOutfitResultClothes(resultIds)
              .then((res) => {
                const results = res.data?.results || [];
                const newCache = {};
                results.forEach((r) => {
                  newCache[r.resultId] = r.clothes;
                });
                setClothesCache((prev) => ({ ...prev, ...newCache }));
              })
              .catch((err) => console.error('옷 상세 조회 실패:', err));
          }
        }
      } else if (status === 'CLARIFICATION_NEEDED' || status === 'clarification_needed') {
        setMessages((prev) => {
          const updated = prev.filter((m) => m.type !== 'ai-loading');
          updated.push({
            type: 'ai',
            content: event.aiMessage || '질문을 좀 더 구체적으로 해주세요.',
            outfits: [],
            createdAt: new Date().toISOString(),
            turnNo: event.turnNo,
            isClarification: true,
          });
          return updated;
        });
        setIsSubmitting(false);
        scrollToBottom();
      } else if (status === 'FAILED' || status === 'failed') {
        setMessages((prev) => {
          const updated = prev.filter((m) => m.type !== 'ai-loading');
          updated.push({
            type: 'ai',
            content: event.message || '코디 추천에 실패했어요. 다시 시도해주세요.',
            outfits: [],
            createdAt: new Date().toISOString(),
            turnNo: event.turnNo,
            isFailed: true,
          });
          return updated;
        });
        setIsSubmitting(false);
        scrollToBottom();
      }
    };

    setOutfitEventHandler(handleOutfitEvent);

    return () => {
      clearOutfitEventHandler();
    };
  }, [sessionId, stompConnected, setOutfitEventHandler, clearOutfitEventHandler, scrollToBottom]);

  // 메시지 전송
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isSubmitting) {
      return;
    }

    if (text.length < 2) {
      showError('2자 이상 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setInputText('');

    // 사용자 메시지 즉시 추가
    setMessages((prev) => [
      ...prev,
      {
        type: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      },
      {
        type: 'ai-loading',
        stepLabel: '코디를 찾고 있어요...',
      },
    ]);
    scrollToBottom();

    try {
      await createOutfitRequestV2(text, sessionId);
    } catch (err) {
      setMessages((prev) => {
        const updated = prev.filter((m) => m.type !== 'ai-loading');
        updated.push({
          type: 'ai',
          content: err.message || '코디 요청에 실패했어요. 다시 시도해주세요.',
          outfits: [],
          createdAt: new Date().toISOString(),
          isFailed: true,
        });
        return updated;
      });
      setIsSubmitting(false);
      scrollToBottom();
    }
  }, [inputText, isSubmitting, sessionId, showError, scrollToBottom]);

  // 리액션 처리
  const handleReaction = useCallback(
    async (resultId, type) => {
      const currentReaction = reactions[resultId] || 'NONE';
      const newReaction = currentReaction === type ? 'NONE' : type;

      setReactions((prev) => ({ ...prev, [resultId]: newReaction }));

      try {
        await updateOutfitReactionV2(resultId, newReaction);
      } catch (err) {
        // 실패 시 롤백
        setReactions((prev) => ({ ...prev, [resultId]: currentReaction }));
      }
    },
    [reactions]
  );

  // 뒤로가기
  const handleBack = () => {
    navigate('/ai-coordi');
  };

  // 로딩 중 AI 처리 여부 (입력 비활성화 판단)
  const hasLoadingMessage = messages.some((m) => m.type === 'ai-loading');

  // 리뷰 모달에서 현재 보고 있는 outfit
  const currentReviewOutfit = reviewModal.open ? reviewModal.outfits[reviewModal.index] : null;
  const currentReviewReaction = currentReviewOutfit
    ? reactions[currentReviewOutfit.resultId] || 'NONE'
    : 'NONE';

  return (
    <div className="outfit-chat">
      {/* 헤더 */}
      <Header title={sessionTitle} showBack onBack={handleBack} />

      {/* 대화 영역 */}
      <div className="outfit-chat__messages-wrapper">
        <div className="outfit-chat__messages" ref={scrollContainerRef}>
          {isLoading ? (
            <div className="outfit-chat__center-loading">
              <Spinner size="large" />
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => {
                if (msg.type === 'user') {
                  return (
                    <div key={idx} className="outfit-chat__bubble-wrap outfit-chat__bubble-wrap--user">
                      <div className="outfit-chat__bubble outfit-chat__bubble--user">
                        <span className="outfit-chat__bubble-text">{msg.content}</span>
                      </div>
                      <span className="outfit-chat__bubble-time">
                        {formatMessageTime(msg.createdAt)}
                      </span>
                    </div>
                  );
                }

                if (msg.type === 'ai-loading') {
                  return (
                    <div key={idx} className="outfit-chat__bubble-wrap outfit-chat__bubble-wrap--ai">
                      <div className="outfit-chat__bubble outfit-chat__bubble--ai">
                        <div className="outfit-chat__loading-indicator">
                          <span className="outfit-chat__loading-dots">
                            <span />
                            <span />
                            <span />
                          </span>
                          <span className="outfit-chat__loading-label">{msg.stepLabel}</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (msg.type === 'ai') {
                  const isLatestTurn = idx === latestReactableMsgIdx;

                  return (
                    <div key={idx} className="outfit-chat__bubble-wrap outfit-chat__bubble-wrap--ai">
                      <div className="outfit-chat__bubble outfit-chat__bubble--ai">
                        {msg.content && (
                          <span className="outfit-chat__bubble-text">{msg.content}</span>
                        )}
                      </div>
                      {/* 코디 카드 가로 스크롤 */}
                      {msg.outfits && msg.outfits.length > 0 && (
                        <div className="outfit-chat__cards-scroll">
                          {msg.outfits.map((outfit, oIdx) => (
                            <OutfitCard
                              key={outfit.resultId || oIdx}
                              outfit={outfit}
                              index={oIdx}
                              total={msg.outfits.length}
                              reaction={reactions[outfit.resultId] || 'NONE'}
                              isReactable={isLatestTurn}
                              onImageClick={() => openReviewModal(msg.outfits, oIdx, isLatestTurn)}
                            />
                          ))}
                        </div>
                      )}
                      <span className="outfit-chat__bubble-time">
                        {formatMessageTime(msg.createdAt)}
                      </span>
                    </div>
                  );
                }

                return null;
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* 하단 입력창 */}
      <div className="outfit-chat__input-bar">
        <input
          className="outfit-chat__text-input"
          type="text"
          placeholder="추가 요청을 입력하세요..."
          value={inputText}
          onChange={(e) => {
            if (e.target.value.length <= 100) {
              setInputText(e.target.value);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isSubmitting) {
              handleSend();
            }
          }}
          maxLength={100}
          disabled={hasLoadingMessage}
        />
        <button
          className="outfit-chat__send-btn"
          onClick={handleSend}
          disabled={!inputText.trim() || hasLoadingMessage}
        >
          <IoArrowUp size={20} />
        </button>
      </div>

      {/* 리뷰 모달 — 코디 결과 이미지 캐러셀 + 리액션 */}
      {reviewModal.open && currentReviewOutfit && (
        <div className="outfit-review__overlay" onClick={closeReviewModal}>
          <div className="outfit-review__modal" onClick={(e) => e.stopPropagation()}>
            <button className="outfit-review__close" onClick={closeReviewModal} aria-label="닫기">
              <IoClose size={24} />
            </button>

            <div className="outfit-review__image-area">
              {reviewModal.index > 0 && (
                <button
                  className="outfit-review__nav outfit-review__nav--prev"
                  onClick={reviewPrev}
                  aria-label="이전 코디"
                >
                  <IoChevronBack size={24} />
                </button>
              )}

              <img
                src={currentReviewOutfit.vtonImageUrl}
                alt={`코디 ${reviewModal.index + 1}`}
                className="outfit-review__image"
              />

              {reviewModal.index < reviewModal.outfits.length - 1 && (
                <button
                  className="outfit-review__nav outfit-review__nav--next"
                  onClick={reviewNext}
                  aria-label="다음 코디"
                >
                  <IoChevronForward size={24} />
                </button>
              )}
            </div>

            {/* 위치 인디케이터 */}
            <div className="outfit-review__indicator">
              {reviewModal.outfits.map((_, i) => (
                <span
                  key={i}
                  className={`outfit-review__dot${i === reviewModal.index ? ' outfit-review__dot--active' : ''}`}
                  onClick={() => setReviewModal((prev) => ({ ...prev, index: i }))}
                />
              ))}
            </div>

            {/* 착용 아이템 정보 */}
            {currentReviewOutfit.resultId && (
              <div className="outfit-review__clothes">
                <span className="outfit-review__clothes-title">착용 아이템</span>
                {clothesLoading && !clothesCache[currentReviewOutfit.resultId] ? (
                  <div className="outfit-review__clothes-loading">
                    <Spinner size="small" />
                  </div>
                ) : clothesCache[currentReviewOutfit.resultId]?.length > 0 ? (
                  <div className="outfit-review__clothes-list">
                    {clothesCache[currentReviewOutfit.resultId].map((item) => (
                      <div
                        key={item.id}
                        className="outfit-review__clothes-item"
                        onClick={() => {
                          closeReviewModal();
                          navigate(`/clothes/${item.id}`);
                        }}
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.name || '옷'}
                          className="outfit-review__clothes-image"
                        />
                        <span className="outfit-review__clothes-name">
                          {item.name || '이름 없음'}
                        </span>
                        <span className="outfit-review__clothes-category">
                          {item.category || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  !clothesLoading && (
                    <span className="outfit-review__clothes-empty">아이템 정보 없음</span>
                  )
                )}
              </div>
            )}

            {/* 리액션 버튼 — 최신 턴에서만 노출 */}
            {reviewModal.isReactable && (
              <div className="outfit-review__actions">
                <button
                  className={`outfit-review__reaction-btn${currentReviewReaction === 'GOOD' ? ' outfit-review__reaction-btn--good-active' : ''}`}
                  onClick={() => handleReaction(currentReviewOutfit.resultId, 'GOOD')}
                >
                  {currentReviewReaction === 'GOOD' ? (
                    <IoThumbsUp size={28} />
                  ) : (
                    <IoThumbsUpOutline size={28} />
                  )}
                  <span>좋아요</span>
                </button>
                <button
                  className={`outfit-review__reaction-btn${currentReviewReaction === 'BAD' ? ' outfit-review__reaction-btn--bad-active' : ''}`}
                  onClick={() => handleReaction(currentReviewOutfit.resultId, 'BAD')}
                >
                  {currentReviewReaction === 'BAD' ? (
                    <IoThumbsDown size={28} />
                  ) : (
                    <IoThumbsDownOutline size={28} />
                  )}
                  <span>별로예요</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OutfitChatPage;
