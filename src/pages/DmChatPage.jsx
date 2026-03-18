import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Spinner, AlertModal } from '../components/common';
import { useChatContext } from '../contexts/ChatContext';
import {
  getChatMessages,
  leaveChatRoom,
  markChatAsRead,
  getPresignedUrls,
  uploadToS3,
  getFeedDetail,
} from '../api';
import { IoChevronBack, IoEllipsisHorizontal, IoImageOutline, IoPaperPlane, IoChevronDown } from 'react-icons/io5';
import './DmChatPage.css';
import defaultProfile from '../assets/defalt.png';

const MAX_IMAGES = 3;
const SEND_TIMEOUT = 5000;

// 이미지 로드 실패 시 X placeholder 표시
const ChatImage = ({ src, alt, className, onClick }) => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="dm-chat-page__bubble-image-error">
        <span>✕</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      onClick={onClick}
    />
  );
};

// FEED 메시지 미리보기 카드 (feedId로 피드 정보 fetch)
const FeedPreviewBubble = ({ feedId, onNavigate }) => {
  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!feedId) {
      setIsLoading(false);
      return;
    }
    getFeedDetail(feedId)
      .then(res => {
        const d = res.data;
        setPreview({
          imageUrl: d.imageUrls?.[0] ?? null,
          content: d.content ?? '',
          nickname: d.userProfile?.nickname ?? '',
          profileImageUrl: d.userProfile?.userProfileImageUrl ?? null,
        });
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [feedId]);

  const handleClick = () => {
    if (feedId) {
      onNavigate(`/feed/${feedId}`);
    }
  };

  if (isLoading) {
    return <div className="dm-chat-page__bubble-feed-skeleton" />;
  }

  return (
    <div className="dm-chat-page__bubble-feed-card" onClick={handleClick}>
      <div className="dm-chat-page__bubble-feed-author">
        {preview?.profileImageUrl ? (
          <img
            src={preview.profileImageUrl}
            alt={preview.nickname}
            className="dm-chat-page__bubble-feed-avatar"
          />
        ) : (
          <div className="dm-chat-page__bubble-feed-avatar-placeholder" />
        )}
        <span className="dm-chat-page__bubble-feed-nickname">
          {preview?.nickname ?? ''}
        </span>
      </div>
      {preview?.imageUrl && (
        <img
          src={preview.imageUrl}
          alt="피드 이미지"
          className="dm-chat-page__bubble-feed-thumb"
        />
      )}
      {preview?.content && (
        <p className="dm-chat-page__bubble-feed-preview">
          <strong>{preview.nickname}</strong> {preview.content}
        </p>
      )}
    </div>
  );
};

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
  const {
    subscribeToRoom,
    sendChatMessage,
    myUserId,
    fetchUnreadStatus,
    latestMessageError,
    setActiveRoomId,
    stompConnected,
  } = useChatContext();

  const opponent = location.state?.opponent ?? null;

  // ── 메시지 / 페이징 상태 ────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // ── UI 상태 ─────────────────────────────────────────────────
  const [inputText, setInputText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  // 스크롤이 위에 있을 때 새 메시지 수신 시 배지로 표시
  const [newMessageCount, setNewMessageCount] = useState(0);
  // 이미지 전체보기 모달
  const [selectedImage, setSelectedImage] = useState(null);

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const subscriptionRef = useRef(null);
  const pendingMessagesRef = useRef({});
  const fileInputRef = useRef(null);

  // 초기 스크롤 포지셔닝 중 scroll 핸들러를 차단하는 플래그
  const isInitializingRef = useRef(false);
  // 동기적 로딩 가드: 중복 호출 방지
  const isLoadingMoreRef = useRef(false);

  // ── 유틸 ────────────────────────────────────────────────────

  // 스크롤이 하단 100px 이내인지 확인
  const checkIfNearBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return true;
    }
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom < 100;
  }, []);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // ── 새 메시지 수신 핸들러 (구독 effect보다 먼저 정의) ────────
  const handleNewMessage = useCallback((msg) => {
    const clientId = msg.clientMessageId;

    setMessages(prev => {
      // 낙관적 메시지(clientMessageId 일치)가 있으면 교체
      const idx = clientId
        ? prev.findIndex(m => m.clientMessageId === clientId)
        : -1;
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

    // 하단 근접 시 자동 스크롤, 아니면 배지 카운트 증가
    if (checkIfNearBottom()) {
      scrollToBottom();
    } else if (msg.senderId !== myUserId) {
      setNewMessageCount(prev => prev + 1);
    }
  }, [roomId, scrollToBottom, checkIfNearBottom, myUserId]);

  // ── 초기 메시지 로드 (항상 DESC → reverse, 최신이 아래) ─────
  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true);
      try {
        const response = await getChatMessages(roomId, null, 50);
        const { messages: msgs, nextCursor, hasNextPage } = response.data;
        const ordered = [...(msgs ?? [])].reverse();

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
      } catch (err) {
        console.error('메시지 로드 실패:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ── 로드 완료 후 즉시 하단 스크롤 ─────────────────────────────
  useEffect(() => {
    if (!isLoading) {
      const container = scrollContainerRef.current;
      if (!container) {
        return;
      }
      isInitializingRef.current = true;
      container.scrollTop = container.scrollHeight;
      setTimeout(() => {
        isInitializingRef.current = false;
      }, 0);
    }
  // isLoading이 false로 바뀔 때 1회만 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // ── STOMP 연결/재연결 시 방 구독 (재)등록 ──────────────────────
  // stompConnected가 true가 될 때마다 실행 → 재연결 후 구독 재등록 보장
  useEffect(() => {
    if (!stompConnected) {
      return;
    }

    // 기존 구독 해제 후 재구독
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    const sub = subscribeToRoom(roomId, handleNewMessage);
    subscriptionRef.current = sub;

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [roomId, stompConnected, subscribeToRoom, handleNewMessage]);

  // ── 채팅방 진입/이탈 시 activeRoomId 등록 ─────────────────────
  useEffect(() => {
    setActiveRoomId(Number(roomId));
    return () => {
      setActiveRoomId(null);
    };
  }, [roomId, setActiveRoomId]);

  // ── STOMP 에러 수신 시 해당 메시지를 즉시 실패 상태로 전환 ─────
  useEffect(() => {
    if (!latestMessageError) {
      return;
    }
    const { clientMessageId } = latestMessageError;
    if (!clientMessageId) {
      return;
    }
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

  // ── 이전 메시지 더보기 (상단 스크롤 시 backward 페이징) ─────────
  const loadMoreMessages = useCallback(async () => {
    if (!hasMore || !cursor || isLoadingMoreRef.current) {
      return;
    }
    isLoadingMoreRef.current = true;
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

      // 스크롤 위치 보정: 기존에 보던 메시지가 유지되도록
      setTimeout(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - prevScrollHeight;
        }
      }, 0);
    } catch (err) {
      console.error('이전 메시지 로드 실패:', err);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [roomId, cursor, hasMore]);

  // ── 스크롤 핸들러 ───────────────────────────────────────────
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      if (isInitializingRef.current) {
        return;
      }

      // 하단 도달 시 배지 초기화
      if (checkIfNearBottom()) {
        setNewMessageCount(0);
      }

      // 상단 80px 이내: 이전 이력 로드
      if (container.scrollTop < 80 && hasMore && !isLoadingMoreRef.current) {
        loadMoreMessages();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, loadMoreMessages, checkIfNearBottom]);

  // ── 텍스트 메시지 전송 ──────────────────────────────────────
  const handleSendText = useCallback(() => {
    const text = inputText.trim();
    if (!text) {
      return;
    }

    const clientMessageId = crypto.randomUUID();

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
      sendChatMessage(roomId, {
        type: 'TEXT',
        content: text,
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
      setMessages(prev =>
        prev.map(m =>
          m.clientMessageId === clientMessageId ? { ...m, status: 'failed' } : m
        )
      );
    }
  }, [inputText, myUserId, roomId, sendChatMessage, scrollToBottom]);

  // ── 이미지 전송 ─────────────────────────────────────────────
  const handleImageSelect = useCallback(async (e) => {
    const files = Array.from(e.target.files).slice(0, MAX_IMAGES);
    if (files.length === 0) {
      return;
    }

    const clientMessageId = crypto.randomUUID();

    // S3 업로드 전 sending 상태 낙관적 표시 (_mediaFileIds는 업로드 후 채움)
    const optimistic = {
      messageId: null,
      clientMessageId,
      senderId: myUserId,
      type: 'IMAGE',
      images: files.map(f => ({ imageUrl: URL.createObjectURL(f) })),
      createdAt: new Date().toISOString(),
      status: 'sending',
      _mediaFileIds: null,
    };
    setMessages(prev => [...prev, optimistic]);
    scrollToBottom();

    try {
      const fileInfos = files.map(f => ({ name: f.name, type: f.type }));
      const presignedResponse = await getPresignedUrls('CHAT', fileInfos);
      const urlInfos = presignedResponse.data;

      await Promise.all(urlInfos.map((info, i) => uploadToS3(info.presignedUrl, files[i])));
      const mediaFileIds = urlInfos.map(info => info.fileId);

      // 업로드 완료 후 재전송에 쓸 mediaFileIds 저장
      setMessages(prev =>
        prev.map(m =>
          m.clientMessageId === clientMessageId
            ? { ...m, _mediaFileIds: mediaFileIds }
            : m
        )
      );

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
        setMessages(prev =>
          prev.map(m =>
            m.clientMessageId === clientMessageId ? { ...m, status: 'failed' } : m
          )
        );
      }
    } catch (err) {
      console.error('이미지 전송 실패 (업로드 오류):', err);
      // S3 업로드 실패 시 즉시 failed 처리
      setMessages(prev =>
        prev.map(m =>
          m.clientMessageId === clientMessageId ? { ...m, status: 'failed' } : m
        )
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [myUserId, roomId, sendChatMessage, scrollToBottom]);

  // ── 재전송 ──────────────────────────────────────────────────
  const handleRetry = useCallback((msg) => {
    if (msg.type === 'TEXT') {
      setMessages(prev => prev.filter(m => m.clientMessageId !== msg.clientMessageId));
      setInputText(msg.content || '');
    } else if (msg.type === 'IMAGE') {
      const mediaFileIds = msg._mediaFileIds;
      if (!mediaFileIds || mediaFileIds.length === 0) {
        // S3 업로드 전 실패한 경우 → 삭제만 (재업로드 필요)
        setMessages(prev => prev.filter(m => m.clientMessageId !== msg.clientMessageId));
        return;
      }

      // 새 clientMessageId로 STOMP 재전송
      const newClientMessageId = crypto.randomUUID();
      setMessages(prev =>
        prev.map(m =>
          m.clientMessageId === msg.clientMessageId
            ? { ...m, clientMessageId: newClientMessageId, status: 'sending' }
            : m
        )
      );

      try {
        sendChatMessage(roomId, {
          type: 'IMAGE',
          mediaFileIds,
          clientMessageId: newClientMessageId,
        });

        const timeout = setTimeout(() => {
          setMessages(prev =>
            prev.map(m =>
              m.clientMessageId === newClientMessageId ? { ...m, status: 'failed' } : m
            )
          );
          delete pendingMessagesRef.current[newClientMessageId];
        }, SEND_TIMEOUT);
        pendingMessagesRef.current[newClientMessageId] = timeout;
      } catch (_) {
        setMessages(prev =>
          prev.map(m =>
            m.clientMessageId === newClientMessageId ? { ...m, status: 'failed' } : m
          )
        );
      }
    }
  }, [roomId, sendChatMessage]);

  // ── 실패 메시지 삭제 ─────────────────────────────────────────
  const handleDeleteFailed = useCallback((clientMessageId) => {
    setMessages(prev => prev.filter(m => m.clientMessageId !== clientMessageId));
  }, []);

  // ── 새 메시지 배지 클릭: 하단 스크롤 + 카운트 초기화 ───────────
  const handleNewMessageBadgeClick = useCallback(() => {
    setNewMessageCount(0);
    scrollToBottom();
  }, [scrollToBottom]);

  // ── 채팅방 나가기 ──────────────────────────────────────────
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
            <img src={opponent.profileImageUrl || defaultProfile} alt={opponent.nickname} className="dm-chat-page__header-avatar-placeholder"/>
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

      {/* 메시지 + 배지 래퍼 */}
      <div className="dm-chat-page__messages-wrapper">
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

              {messages.map((msg, idx) => {
                const isMine = msg.senderId === myUserId;
                const bubbleBase = `dm-chat-page__bubble ${isMine ? 'dm-chat-page__bubble--mine' : 'dm-chat-page__bubble--theirs'}`;
                return (
                  <div
                    key={msg.messageId ?? msg.clientMessageId ?? idx}
                    className={`dm-chat-page__bubble-wrap ${isMine ? 'dm-chat-page__bubble-wrap--mine' : 'dm-chat-page__bubble-wrap--theirs'}`}
                  >
                    {msg.type === 'FEED' ? (
                      <>
                        <FeedPreviewBubble
                          feedId={msg.relatedFeedId}
                          onNavigate={navigate}
                        />
                        <div className={bubbleBase}>
                          <span className="dm-chat-page__bubble-text">피드를 보냈습니다</span>
                        </div>
                      </>
                    ) : (
                      <div
                        className={`${bubbleBase}${msg.type === 'IMAGE' ? ' dm-chat-page__bubble--image' : ''}`}
                      >
                        {msg.type === 'TEXT' && (
                          <span className="dm-chat-page__bubble-text">{msg.content}</span>
                        )}
                        {msg.type === 'IMAGE' && (
                          <div className={`dm-chat-page__bubble-images dm-chat-page__bubble-images--${(msg.images || []).length}`}>
                            {(msg.images || []).map((img, i) => (
                              <ChatImage
                                key={i}
                                src={img.imageUrl}
                                alt={`이미지 ${i + 1}`}
                                className="dm-chat-page__bubble-image"
                                onClick={() => setSelectedImage({ images: msg.images || [], index: i })}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className={`dm-chat-page__bubble-meta ${isMine ? 'dm-chat-page__bubble-meta--mine' : ''}`}>
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

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* 새 메시지 배지: 스크롤이 위에 있을 때 상대방 메시지 수신 시 표시 */}
        {newMessageCount > 0 && (
          <button
            className="dm-chat-page__new-message-badge"
            onClick={handleNewMessageBadgeClick}
          >
            <span>새 메시지 {newMessageCount}개</span>
            <IoChevronDown size={14} />
          </button>
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

      {/* 이미지 전체보기 모달 */}
      {selectedImage && (
        <div
          className="dm-chat-page__image-modal"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="dm-chat-page__image-modal-close"
            onClick={() => setSelectedImage(null)}
          >
            ✕
          </button>
          {selectedImage.index > 0 && (
            <button
              className="dm-chat-page__image-modal-prev"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage(prev => ({ ...prev, index: prev.index - 1 }));
              }}
            >
              ‹
            </button>
          )}
          <img
            src={selectedImage.images[selectedImage.index]?.imageUrl}
            alt="이미지 전체보기"
            className="dm-chat-page__image-modal-img"
            onClick={(e) => e.stopPropagation()}
          />
          {selectedImage.index < selectedImage.images.length - 1 && (
            <button
              className="dm-chat-page__image-modal-next"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage(prev => ({ ...prev, index: prev.index + 1 }));
              }}
            >
              ›
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DmChatPage;
