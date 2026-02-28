import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
    return '피드를 보냈습니다';
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

// 활성 채팅방(lastMessage 있는 방)이 이 수 미만이면 다음 페이지 자동 로드
const MIN_VISIBLE_ROOMS = 10;

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

  // rooms 최신값을 effect 의존성 없이 참조하기 위한 ref
  // (latestRoomUpdate effect에서 rooms를 deps에 추가하면 무한루프 위험)
  const roomsRef = useRef(rooms);
  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  // 렌더마다 filter를 중복 실행하지 않도록 메모이제이션
  const visibleRooms = useMemo(
    () => rooms.filter(room => room.lastMessage != null),
    [rooms]
  );

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

  // 활성 채팅방이 MIN_VISIBLE_ROOMS 미만이면 다음 페이지 자동 로드
  // (빈 채팅방이 많을 경우 사용자가 스크롤도 못하고 빈 화면을 보는 상황 방지)
  useEffect(() => {
    if (isLoading) { return; }
    if (visibleRooms.length < MIN_VISIBLE_ROOMS && hasMore && !isLoadingMoreRef.current) {
      loadRooms(cursor);
    }
  }, [visibleRooms, hasMore, isLoading, cursor, loadRooms]);

  // 실시간 채팅방 업데이트 반영
  // roomsRef를 사용해 setState 업데이터를 순수 함수로 유지
  // (업데이터 내 loadRooms 호출은 Strict Mode에서 2회 실행될 수 있는 안티패턴)
  useEffect(() => {
    if (!latestRoomUpdate || latestRoomUpdate.senderId === myUserId) {
      return;
    }

    const idx = roomsRef.current.findIndex(r => r.roomId === latestRoomUpdate.roomId);
    if (idx === -1) {
      // 새 채팅방이면 목록 다시 로드 (업데이터 밖에서 호출)
      loadRooms(null);
      return;
    }

    setRooms(prev => {
      const prevIdx = prev.findIndex(r => r.roomId === latestRoomUpdate.roomId);
      if (prevIdx === -1) { return prev; }
      const updated = { ...prev[prevIdx] };
      updated.lastMessage = { ...latestRoomUpdate.lastMessage };
      updated.unreadCount = (updated.unreadCount || 0) + 1;
      const rest = prev.filter((_, i) => i !== prevIdx);
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
      ) : visibleRooms.length === 0 ? (
        <div className="dm-list-page__empty">
          <p>메시지가 없습니다</p>
        </div>
      ) : (
        <div className="dm-list-page__list">
          {visibleRooms.map((room) => (
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
