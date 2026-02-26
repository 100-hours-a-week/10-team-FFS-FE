import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Spinner, AlertModal } from '../components/common';
import { useChatContext } from '../contexts/ChatContext';
import {
  getChatMessages,
  getUnreadChatMessages,
  leaveChatRoom,
  markChatAsRead,
  getPresignedUrls,
  uploadToS3,
} from '../api';
import { IoChevronBack, IoEllipsisHorizontal, IoImageOutline, IoPaperPlane } from 'react-icons/io5';
import './DmChatPage.css';

const MAX_IMAGES = 3;
const SEND_TIMEOUT = 5000;

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

const DmChatPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { subscribeToRoom, sendChatMessage, myUserId, fetchUnreadStatus, latestMessageError, setActiveRoomId } = useChatContext();

  const opponent = location.state?.opponent ?? null;
  const initialUnreadCount = location.state?.unreadCount ?? 0;

  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 언읽음 모드: 아래 방향(forward) 페이징 + 위 방향(backward) 이력 페이징 이중 관리
  const [isUnreadMode, setIsUnreadMode] = useState(false);
  const [forwardCursor, setForwardCursor] = useState(null);
  const [hasMoreUnread, setHasMoreUnread] = useState(false);
  const [isLoadingMoreUnread, setIsLoadingMoreUnread] = useState(false);

  const [inputText, setInputText] = useState('');

  const [showMenu, setShowMenu] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesTopRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const subscriptionRef = useRef(null);
  const pendingMessagesRef = useRef({}); // clientMessageId → timeout
  const fileInputRef = useRef(null);

  // 메시지 배열 끝으로 스크롤
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // 초기 메시지 로드
  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true);
      try {
        if (initialUnreadCount > 0) {
          // 언읽음 모드: ASC(오래된순) — 위쪽은 이력(backward), 아래쪽은 더 많은 언읽음(forward)
          const response = await getUnreadChatMessages(roomId, null, 50);
          const { messages: msgs, nextCursor, hasNextPage } = response.data;
          const safeMsgs = msgs ?? [];
          const ordered = [...safeMsgs]; // ASC 그대로 사용

          setMessages(ordered.map(m => ({ ...m, status: 'sent' })));
          setIsUnreadMode(true);
          setForwardCursor(nextCursor ?? null);
          setHasMoreUnread(hasNextPage ?? false);

          // 이력 backward 페이징: 가장 오래된 언읽음 메시지 이전 기록 조회용 커서
          if (ordered.length > 0) {
            setCursor(ordered[0].messageId);
            setHasMore(true);
          }

          // 마지막 메시지 읽음 처리
          if (ordered.length > 0) {
            const lastId = ordered[ordered.length - 1].messageId;
            try {
              await markChatAsRead(roomId, lastId);
              fetchUnreadStatus();
            } catch (_) { /* 읽음 처리 실패는 무시 */ }
          }
        } else {
          // 일반 모드: DESC → reverse → 최신이 아래
          const response = await getChatMessages(roomId, null, 50);
          const { messages: msgs, nextCursor, hasNextPage } = response.data;
          const safeMsgs = msgs ?? [];
          const ordered = [...safeMsgs].reverse();

          setMessages(ordered.map(m => ({ ...m, status: 'sent' })));
          setCursor(nextCursor ?? null);
          setHasMore(hasNextPage ?? false);

          // 마지막 메시지 읽음 처리
          if (ordered.length > 0) {
            const lastId = ordered[ordered.length - 1].messageId;
            try {
              await markChatAsRead(roomId, lastId);
              fetchUnreadStatus();
            } catch (_) { /* 읽음 처리 실패는 무시 */ }
          }
        }
      } catch (err) {
        console.error('메시지 로드 실패:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // 로드 후 초기 스크롤
  // - 일반 모드: 최신 메시지(하단)로 이동
  // - 언읽음 모드: 첫 번째 언읽음 메시지가 최상단에 보이도록 scrollTop = 0
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      setTimeout(() => {
        if (isUnreadMode) {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
          }
        } else {
          scrollToBottom();
        }
      }, 100);
    }
  // messages.length는 의도적으로 제외: 로드 완료 시에만 1회 스크롤
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isUnreadMode, scrollToBottom]);

  // STOMP 구독
  useEffect(() => {
    const sub = subscribeToRoom(roomId, handleNewMessage);
    subscriptionRef.current = sub;

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, subscribeToRoom]);

  // 채팅방 진입/이탈 시 activeRoomId 등록 — ChatContext의 red-dot 억제에 활용
  useEffect(() => {
    setActiveRoomId(Number(roomId));
    return () => {
      setActiveRoomId(null);
    };
  }, [roomId, setActiveRoomId]);

  // STOMP 에러 수신 시 해당 메시지를 즉시 실패 상태로 전환
  useEffect(() => {
    if (!latestMessageError) {
      return;
    }
    const { clientMessageId } = latestMessageError;
    if (!clientMessageId) {
      return;
    }
    // 5초 타임아웃이 남아있으면 클리어 후 즉시 실패 처리
    if (pendingMessagesRef.current[clientMessageId]) {
      clearTimeout(pendingMessagesRef.current[clientMessageId]);
      delete pendingMessagesRef.current[clientMessageId];
    }
    setMessages(prev =>
      prev.map(m =>
        m.clientMessageId === clientMessageId ? { ...m, status: 'failed' } : m
      )
    );
  }, [latestMessageError]);

  // 새 메시지 수신 핸들러
  const handleNewMessage = useCallback((msg) => {
    const clientId = msg.clientMessageId;

    setMessages(prev => {
      // 이미 clientMessageId로 낙관적 추가된 메시지면 교체
      const idx = clientId ? prev.findIndex(m => m.clientMessageId === clientId) : -1;
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = { ...msg, status: 'sent' };
        return updated;
      }
      return [...prev, { ...msg, status: 'sent' }];
    });

    // 타임아웃 클리어
    if (clientId && pendingMessagesRef.current[clientId]) {
      clearTimeout(pendingMessagesRef.current[clientId]);
      delete pendingMessagesRef.current[clientId];
    }

    // 읽음 처리
    if (msg.messageId) {
      markChatAsRead(roomId, msg.messageId).catch(() => {});
    }

    scrollToBottom();
  }, [roomId, scrollToBottom]);

  // 이전 메시지 더보기 (상단 스크롤)
  const loadMoreMessages = useCallback(async () => {
    if (!hasMore || !cursor || isLoadingMore) {
      return;
    }
    setIsLoadingMore(true);

    const container = scrollContainerRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;

    try {
      const response = await getChatMessages(roomId, cursor, 50);
      const { messages: msgs, nextCursor, hasNextPage } = response.data;
      const ordered = [...(msgs ?? [])].reverse();

      setMessages(prev => [
        ...ordered.map(m => ({ ...m, status: 'sent' })),
        ...prev,
      ]);
      setCursor(nextCursor ?? null);
      setHasMore(hasNextPage ?? false);

      // 스크롤 위치 보정
      setTimeout(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - prevScrollHeight;
        }
      }, 0);
    } catch (err) {
      console.error('이전 메시지 로드 실패:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [roomId, cursor, hasMore, isLoadingMore]);

  // 언읽음 모드: 아래 방향 페이징 (더 많은 언읽음 메시지 로드)
  const loadMoreUnread = useCallback(async () => {
    if (!hasMoreUnread || !forwardCursor || isLoadingMoreUnread) {
      return;
    }
    setIsLoadingMoreUnread(true);
    try {
      const response = await getUnreadChatMessages(roomId, forwardCursor, 50);
      const { messages: msgs, nextCursor, hasNextPage } = response.data;
      const safeMsgs = msgs ?? [];

      setMessages(prev => [
        ...prev,
        ...safeMsgs.map(m => ({ ...m, status: 'sent' })),
      ]);
      setForwardCursor(nextCursor ?? null);
      setHasMoreUnread(hasNextPage ?? false);

      if (safeMsgs.length > 0) {
        const lastId = safeMsgs[safeMsgs.length - 1].messageId;
        markChatAsRead(roomId, lastId).catch(() => {});
      }
    } catch (err) {
      console.error('이후 메시지 로드 실패:', err);
    } finally {
      setIsLoadingMoreUnread(false);
    }
  }, [roomId, forwardCursor, hasMoreUnread, isLoadingMoreUnread]);

  // 상단 무한 스크롤
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      // 상단: 이전 이력 로드 (backward)
      if (container.scrollTop < 80 && hasMore && !isLoadingMore) {
        loadMoreMessages();
      }
      // 하단: 언읽음 모드에서 더 많은 언읽음 메시지 로드 (forward)
      if (isUnreadMode && hasMoreUnread && !isLoadingMoreUnread) {
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distanceFromBottom < 80) {
          loadMoreUnread();
        }
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoadingMore, loadMoreMessages, isUnreadMode, hasMoreUnread, isLoadingMoreUnread, loadMoreUnread]);

  // 텍스트 메시지 전송
  const handleSendText = useCallback(() => {
    const text = inputText.trim();
    if (!text) {
      return;
    }

    const clientMessageId = crypto.randomUUID();

    // 낙관적 UI 추가
    const optimistic = {
      messageId: null,
      clientMessageId,
      senderId: myUserId,
      type: 'TEXT',
      content: text,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };
    setMessages(prev => [...prev, optimistic]);
    setInputText('');
    scrollToBottom();

    try {
      // STOMP SEND (미연결 시 throw)
      sendChatMessage(roomId, {
        type: 'TEXT',
        content: text,
        clientMessageId,
      });

      // 5초 타임아웃 → 전송 실패
      const timeout = setTimeout(() => {
        setMessages(prev =>
          prev.map(m =>
            m.clientMessageId === clientMessageId ? { ...m, status: 'failed' } : m
          )
        );
        delete pendingMessagesRef.current[clientMessageId];
      }, SEND_TIMEOUT);
      pendingMessagesRef.current[clientMessageId] = timeout;
    } catch (_) {
      // STOMP 미연결 시 즉시 실패 처리
      setMessages(prev =>
        prev.map(m =>
          m.clientMessageId === clientMessageId ? { ...m, status: 'failed' } : m
        )
      );
    }
  }, [inputText, myUserId, roomId, sendChatMessage, scrollToBottom]);

  // 이미지 전송
  const handleImageSelect = useCallback(async (e) => {
    const files = Array.from(e.target.files).slice(0, MAX_IMAGES);
    if (files.length === 0) {
      return;
    }

    try {
      // Presigned URL 발급
      const fileInfos = files.map(f => ({ name: f.name, type: f.type }));
      const presignedResponse = await getPresignedUrls('CHAT', fileInfos);
      const urlInfos = presignedResponse.data;

      // S3 업로드
      await Promise.all(urlInfos.map((info, i) => uploadToS3(info.presignedUrl, files[i])));
      const mediaFileIds = urlInfos.map(info => info.fileId);

      const clientMessageId = crypto.randomUUID();

      // 낙관적 UI (이미지 미리보기)
      const optimistic = {
        messageId: null,
        clientMessageId,
        senderId: myUserId,
        type: 'IMAGE',
        images: files.map(f => ({ imageUrl: URL.createObjectURL(f) })),
        createdAt: new Date().toISOString(),
        status: 'sending',
      };
      setMessages(prev => [...prev, optimistic]);
      scrollToBottom();

      try {
        sendChatMessage(roomId, {
          type: 'IMAGE',
          mediaFileIds,
          clientMessageId,
        });

        const timeout = setTimeout(() => {
          setMessages(prev =>
            prev.map(m =>
              m.clientMessageId === clientMessageId ? { ...m, status: 'failed' } : m
            )
          );
          delete pendingMessagesRef.current[clientMessageId];
        }, SEND_TIMEOUT);
        pendingMessagesRef.current[clientMessageId] = timeout;
      } catch (_) {
        // STOMP 미연결 시 즉시 실패 처리
        setMessages(prev =>
          prev.map(m =>
            m.clientMessageId === clientMessageId ? { ...m, status: 'failed' } : m
          )
        );
      }
    } catch (err) {
      console.error('이미지 전송 실패 (업로드 오류):', err);
    } finally {
      // input 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [myUserId, roomId, sendChatMessage, scrollToBottom]);

  // 재전송
  const handleRetry = useCallback((msg) => {
    if (msg.type === 'TEXT') {
      setMessages(prev => prev.filter(m => m.clientMessageId !== msg.clientMessageId));
      setInputText(msg.content || '');
    } else {
      setMessages(prev => prev.filter(m => m.clientMessageId !== msg.clientMessageId));
    }
  }, []);

  // 실패 메시지 삭제
  const handleDeleteFailed = useCallback((clientMessageId) => {
    setMessages(prev => prev.filter(m => m.clientMessageId !== clientMessageId));
  }, []);

  // 채팅방 나가기
  const handleLeave = async () => {
    try {
      await leaveChatRoom(roomId);
      navigate('/dm');
    } catch (err) {
      console.error('채팅방 나가기 실패:', err);
    }
  };

  return (
    <div className="dm-chat-page">
      {/* 커스텀 헤더 */}
      <div className="dm-chat-page__header">
        <button
          className="dm-chat-page__header-back"
          onClick={() => navigate('/dm')}
        >
          <IoChevronBack size={24} />
        </button>

        <div
          className="dm-chat-page__header-info"
          onClick={() => opponent?.userId && navigate(`/profile/${opponent.userId}`)}
        >
          <div className="dm-chat-page__header-avatar">
            {opponent?.profileImageUrl ? (
              <img src={opponent.profileImageUrl} alt={opponent.nickname} />
            ) : (
              <div className="dm-chat-page__header-avatar-placeholder" />
            )}
          </div>
          <span className="dm-chat-page__header-nickname">
            {opponent?.nickname ?? ''}
          </span>
        </div>

        <div className="dm-chat-page__header-right">
          <button
            className="dm-chat-page__header-menu-btn"
            onClick={() => setShowMenu(prev => !prev)}
          >
            <IoEllipsisHorizontal size={24} />
          </button>
          {showMenu && (
            <div className="dm-chat-page__dropdown">
              <button
                className="dm-chat-page__dropdown-item dm-chat-page__dropdown-item--danger"
                onClick={() => {
                  setShowMenu(false);
                  setShowLeaveModal(true);
                }}
              >
                채팅방 나가기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 메시지 영역 */}
      <div
        className="dm-chat-page__messages"
        ref={scrollContainerRef}
        onClick={() => setShowMenu(false)}
      >
        {isLoading ? (
          <div className="dm-chat-page__loading">
            <Spinner size="large" />
          </div>
        ) : (
          <>
            {isLoadingMore && (
              <div className="dm-chat-page__loading-more">
                <Spinner size="small" />
              </div>
            )}
            <div ref={messagesTopRef} />

            {messages.map((msg, idx) => {
              const isMine = msg.senderId === myUserId;
              return (
                <div
                  key={msg.messageId ?? msg.clientMessageId ?? idx}
                  className={`dm-chat-page__bubble-wrap ${isMine ? 'dm-chat-page__bubble-wrap--mine' : 'dm-chat-page__bubble-wrap--theirs'}`}
                >
                  <div
                    className={`dm-chat-page__bubble ${isMine ? 'dm-chat-page__bubble--mine' : 'dm-chat-page__bubble--theirs'}`}
                  >
                    {/* 메시지 타입별 렌더링 */}
                    {msg.type === 'TEXT' && (
                      <span className="dm-chat-page__bubble-text">{msg.content}</span>
                    )}
                    {msg.type === 'IMAGE' && (
                      <div className="dm-chat-page__bubble-images">
                        {(msg.images || []).map((img, i) => (
                          <img
                            key={i}
                            src={img.imageUrl}
                            alt={`이미지 ${i + 1}`}
                            className="dm-chat-page__bubble-image"
                          />
                        ))}
                      </div>
                    )}
                    {msg.type === 'FEED' && (
                      <div
                        className="dm-chat-page__bubble-feed"
                        onClick={() => msg.relatedFeedId && navigate(`/feed/${msg.relatedFeedId}`)}
                      >
                        {msg.feedThumbnailUrl && (
                          <img
                            src={msg.feedThumbnailUrl}
                            alt="피드"
                            className="dm-chat-page__bubble-feed-thumb"
                          />
                        )}
                        <span className="dm-chat-page__bubble-feed-label">[피드]</span>
                      </div>
                    )}
                  </div>

                  <div className={`dm-chat-page__bubble-meta ${isMine ? 'dm-chat-page__bubble-meta--mine' : ''}`}>
                    {/* 전송 상태 */}
                    {msg.status === 'sending' && (
                      <span className="dm-chat-page__status dm-chat-page__status--sending">전송 중</span>
                    )}
                    {msg.status === 'failed' && (
                      <div className="dm-chat-page__status dm-chat-page__status--failed">
                        <button
                          className="dm-chat-page__retry-btn"
                          onClick={() => handleRetry(msg)}
                        >
                          재전송
                        </button>
                        <button
                          className="dm-chat-page__delete-btn"
                          onClick={() => handleDeleteFailed(msg.clientMessageId)}
                        >
                          삭제
                        </button>
                      </div>
                    )}
                    <span className="dm-chat-page__time">
                      {formatMessageTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}

            {isLoadingMoreUnread && (
              <div className="dm-chat-page__loading-more">
                <Spinner size="small" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 입력 바 */}
      <div className="dm-chat-page__input-bar">
        <button
          className="dm-chat-page__image-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          <IoImageOutline size={24} />
        </button>
        <input
          type="file"
          accept="image/jpeg,image/png"
          multiple
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleImageSelect}
        />
        <input
          className="dm-chat-page__text-input"
          type="text"
          placeholder="메시지를 입력하세요..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleSendText();
            }
          }}
        />
        <button
          className="dm-chat-page__send-btn"
          onClick={handleSendText}
          disabled={!inputText.trim()}
        >
          <IoPaperPlane size={20} />
        </button>
      </div>

      {/* 채팅방 나가기 모달 */}
      <AlertModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        title="대화방을 나가시겠어요?"
        message="대화 내용이 모두 삭제됩니다."
        confirmText="나가기"
        cancelText="취소"
        onConfirm={handleLeave}
        danger
      />
    </div>
  );
};

export default DmChatPage;
