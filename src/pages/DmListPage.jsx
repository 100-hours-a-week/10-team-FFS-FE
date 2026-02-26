import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { Spinner } from '../components/common';
import { getChatRooms } from '../api';
import { useChatContext } from '../contexts/ChatContext';
import './DmListPage.css';

// 마지막 메시지 미리보기 텍스트
const getLastMessagePreview = (room) => {
  if (!room.lastMessage) {
    return '';
  }
  if (room.lastMessage.type === 'IMAGE') {
    return '사진을 보냈습니다';
  }
  if (room.lastMessage.type === 'FEED') {
    return '[피드]';
  }
  return room.lastMessage.content || '';
};

// 시간 포맷
const formatRoomTime = (timeStr) => {
  if (!timeStr) {
    return '';
  }
  const date = new Date(timeStr);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours < 12 ? '오전' : '오후';
    const h = hours % 12 || 12;
    return `${ampm} ${h}:${minutes}`;
  }
  return `${date.getMonth() + 1}.${date.getDate()}`;
};

const DmListPage = () => {
  const navigate = useNavigate();
  const { latestRoomUpdate, myUserId } = useChatContext();

  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const observerRef = useRef(null);
  const loadingRef = useRef(null);
  const isLoadingMoreRef = useRef(false);

  // 채팅방 목록 로드
  const loadRooms = useCallback(async (nextCursor = null) => {
    if (isLoadingMoreRef.current) {
      return;
    }
    isLoadingMoreRef.current = true;

    if (!nextCursor) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const response = await getChatRooms(nextCursor, 20);
      const { rooms: newRooms, nextCursor: next, hasNextPage } = response.data;
      const safeRooms = newRooms ?? [];

      setRooms(prev => nextCursor ? [...prev, ...safeRooms] : safeRooms);
      setCursor(next ?? null);
      setHasMore(hasNextPage ?? false);
    } catch (err) {
      console.error('채팅방 목록 조회 실패:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      isLoadingMoreRef.current = false;
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadRooms(null);
  }, [loadRooms]);

  // 실시간 채팅방 업데이트 반영
  useEffect(() => {
    if (!latestRoomUpdate) {
      return;
    }
    if (latestRoomUpdate.senderId === myUserId) {
      return;
    }

    setRooms(prev => {
      const idx = prev.findIndex(r => r.roomId === latestRoomUpdate.roomId);
      if (idx === -1) {
        // 새 채팅방이면 목록 다시 로드
        loadRooms(null);
        return prev;
      }
      const updated = { ...prev[idx] };
      updated.lastMessage = { ...latestRoomUpdate.lastMessage };
      updated.unreadCount = (updated.unreadCount || 0) + 1;

      const rest = prev.filter((_, i) => i !== idx);
      return [updated, ...rest];
    });
  }, [latestRoomUpdate, myUserId, loadRooms]);

  // 무한 스크롤 옵저버
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    if (!hasMore || isLoadingMore) {
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMoreRef.current) {
          loadRooms(cursor);
        }
      },
      { rootMargin: '200px' }
    );

    if (loadingRef.current) {
      observerRef.current.observe(loadingRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, cursor, isLoadingMore, loadRooms]);

  const handleRoomClick = (room) => {
    navigate(`/dm/${room.roomId}`, {
      state: {
        opponent: {
          userId: room.opponent?.userId,
          nickname: room.opponent?.nickname,
          profileImageUrl: room.opponent?.profileImageUrl,
        },
        unreadCount: room.unreadCount || 0,
      },
    });
  };

  return (
    <div className="dm-list-page">
      <Header
        showBack
        onBack={() => navigate('/feed')}
        title="메시지"
      />

      {isLoading ? (
        <div className="dm-list-page__loading">
          <Spinner size="large" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="dm-list-page__empty">
          <p>메시지가 없습니다</p>
        </div>
      ) : (
        <div className="dm-list-page__list">
          {rooms.map((room) => (
            <div
              key={room.roomId}
              className="dm-list-page__room"
              onClick={() => handleRoomClick(room)}
            >
              <div className="dm-list-page__room-avatar">
                {room.opponent?.profileImageUrl ? (
                  <img
                    src={room.opponent.profileImageUrl}
                    alt={room.opponent.nickname}
                  />
                ) : (
                  <div className="dm-list-page__room-avatar-placeholder" />
                )}
              </div>
              <div className="dm-list-page__room-info">
                <div className="dm-list-page__room-top">
                  <span className="dm-list-page__room-nickname">
                    {room.opponent?.nickname}
                  </span>
                  <span className="dm-list-page__room-time">
                    {formatRoomTime(room.lastMessage?.sentAt)}
                  </span>
                </div>
                <div className="dm-list-page__room-bottom">
                  <span className="dm-list-page__room-preview">
                    {getLastMessagePreview(room)}
                  </span>
                  {room.unreadCount > 0 && (
                    <span className="dm-list-page__room-badge">
                      {room.unreadCount > 99 ? '99+' : room.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* 무한 스크롤 트리거 */}
          <div ref={loadingRef} className="dm-list-page__scroll-trigger">
            {isLoadingMore && <Spinner size="small" />}
          </div>
        </div>
      )}
    </div>
  );
};

export default DmListPage;
