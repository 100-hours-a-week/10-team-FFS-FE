import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Header } from '../components/layout';
import { Spinner } from '../components/common';
import { useToast } from '../contexts/ToastContext';
import { useChatContext } from '../contexts/ChatContext';
import {
  getOutfitSessionDetail,
  createOutfitRequestV2,
  updateOutfitReactionV2,
} from '../api';
import {
  IoArrowUp,
  IoThumbsUp,
  IoThumbsUpOutline,
  IoThumbsDown,
  IoThumbsDownOutline,
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
    // 사용자 메시지
    messages.push({
      type: 'user',
      content: turn.userMessage || turn.content || '',
      createdAt: turn.createdAt,
      turnNo: turn.turnNo,
    });

    // AI 응답
    if (turn.status === 'SUCCESS' || turn.status === 'COMPLETED') {
      messages.push({
        type: 'ai',
        content: turn.querySummary || turn.aiMessage || '',
        outfits: turn.outfits || [],
        createdAt: turn.completedAt || turn.createdAt,
        turnNo: turn.turnNo,
      });
    } else if (turn.status === 'CLARIFICATION_NEEDED') {
      messages.push({
        type: 'ai',
        content: turn.aiMessage || '질문을 좀 더 구체적으로 해주세요.',
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
const OutfitCard = ({ outfit, reaction, onReaction }) => {
  const navigate = useNavigate();

  const handleClothesClick = (clothesId) => {
    if (clothesId) {
      navigate(`/clothes/${clothesId}`);
    }
  };

  return (
    <div className="outfit-chat__card">
      {outfit.imageUrl && (
        <img
          src={outfit.imageUrl}
          alt="AI 추천 코디"
          className="outfit-chat__card-image"
        />
      )}
      {outfit.aiComment && (
        <p className="outfit-chat__card-comment">{outfit.aiComment}</p>
      )}
      {/* 사용된 옷 목록 */}
      {outfit.clothes && outfit.clothes.length > 0 && (
        <div className="outfit-chat__card-clothes">
          {outfit.clothes.map((item, idx) => (
            <div
              key={item.clothesId || idx}
              className="outfit-chat__card-clothes-item"
              onClick={() => handleClothesClick(item.clothesId)}
            >
              {item.imageUrl && (
                <img src={item.imageUrl} alt={item.name || '옷'} />
              )}
              {item.name && <span>{item.name}</span>}
            </div>
          ))}
        </div>
      )}
      {/* 피드백 버튼 */}
      {(outfit.outfitId || outfit.feedbackId) && (
        <div className="outfit-chat__card-feedback">
          <button
            className={`outfit-chat__feedback-btn${reaction === 'GOOD' ? ' outfit-chat__feedback-btn--active' : ''}`}
            onClick={() => onReaction(outfit.outfitId || outfit.feedbackId, 'GOOD')}
            aria-label="좋아요"
          >
            {reaction === 'GOOD' ? <IoThumbsUp size={18} /> : <IoThumbsUpOutline size={18} />}
          </button>
          <button
            className={`outfit-chat__feedback-btn${reaction === 'BAD' ? ' outfit-chat__feedback-btn--active' : ''}`}
            onClick={() => onReaction(outfit.outfitId || outfit.feedbackId, 'BAD')}
            aria-label="싫어요"
          >
            {reaction === 'BAD' ? <IoThumbsDown size={18} /> : <IoThumbsDownOutline size={18} />}
          </button>
        </div>
      )}
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

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const hasInitialQuery = useRef(!!initialQuery);

  // 하단 자동 스크롤
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
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
        const orderedTurns = turns[0]?.turnNo > turns[turns.length - 1]?.turnNo
          ? [...turns].reverse()
          : turns;
        const converted = turnsToMessages(orderedTurns);
        setMessages(converted);

        // 기존 리액션 복구
        const existingReactions = {};
        orderedTurns.forEach((turn) => {
          if (turn.outfits) {
            turn.outfits.forEach((outfit) => {
              const id = outfit.outfitId || outfit.feedbackId;
              if (id && outfit.reaction && outfit.reaction !== 'NONE') {
                existingReactions[id] = outfit.reaction;
              }
            });
          }
        });
        setReactions(existingReactions);
      } catch (err) {
        // 세션을 찾을 수 없는 경우 (새 세션 생성 직후 아직 데이터 없음)
        if (hasInitialQuery.current && initialQuery) {
          setMessages([{
            type: 'user',
            content: initialQuery,
            createdAt: new Date().toISOString(),
            turnNo: 1,
          }, {
            type: 'ai-loading',
            stepLabel: '코디를 찾고 있어요...',
            turnNo: 1,
          }]);
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
        // 로딩 인디케이터 stepLabel 업데이트
        setMessages(prev => {
          const lastIdx = prev.length - 1;
          if (lastIdx >= 0 && prev[lastIdx].type === 'ai-loading') {
            const updated = [...prev];
            updated[lastIdx] = { ...updated[lastIdx], stepLabel: stepLabel || '처리 중...' };
            return updated;
          }
          return prev;
        });
      } else if (status === 'SUCCESS' || status === 'success' || status === 'COMPLETED') {
        // AI 응답 도착 → 로딩 메시지를 실제 AI 메시지로 교체
        setMessages(prev => {
          const updated = prev.filter(m => m.type !== 'ai-loading');
          updated.push({
            type: 'ai',
            content: event.querySummary || event.aiMessage || '',
            outfits: event.outfits || [],
            createdAt: event.completedAt || new Date().toISOString(),
            turnNo: event.turnNo,
          });
          return updated;
        });
        setIsSubmitting(false);
        scrollToBottom();
      } else if (status === 'CLARIFICATION_NEEDED' || status === 'clarification_needed') {
        // AI 재질문
        setMessages(prev => {
          const updated = prev.filter(m => m.type !== 'ai-loading');
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
        // 에러
        setMessages(prev => {
          const updated = prev.filter(m => m.type !== 'ai-loading');
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
    setMessages(prev => [
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
      // WebSocket으로 결과 수신 대기 (isSubmitting 유지)
    } catch (err) {
      // 요청 자체 실패
      setMessages(prev => {
        const updated = prev.filter(m => m.type !== 'ai-loading');
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
  const handleReaction = useCallback(async (resultId, type) => {
    const currentReaction = reactions[resultId] || 'NONE';
    const newReaction = currentReaction === type ? 'NONE' : type;

    setReactions(prev => ({ ...prev, [resultId]: newReaction }));

    try {
      await updateOutfitReactionV2(resultId, newReaction);
    } catch (err) {
      // 실패 시 롤백
      setReactions(prev => ({ ...prev, [resultId]: currentReaction }));
    }
  }, [reactions]);

  // 뒤로가기
  const handleBack = () => {
    navigate('/ai-coordi');
  };

  // 로딩 중 AI 처리 여부 (입력 비활성화 판단)
  const hasLoadingMessage = messages.some(m => m.type === 'ai-loading');

  return (
    <div className="outfit-chat">
      {/* 헤더 */}
      <Header
        title={sessionTitle}
        showBack
        onBack={handleBack}
      />

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
                              key={outfit.outfitId || outfit.feedbackId || oIdx}
                              outfit={outfit}
                              reaction={reactions[outfit.outfitId || outfit.feedbackId] || 'NONE'}
                              onReaction={handleReaction}
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
    </div>
  );
};

export default OutfitChatPage;
