import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import { useAuth } from './AuthContext';
import { getAccessToken, getUnreadChatStatus, getWsUrl } from '../api';
import { replaceImageUrls } from '../utils/helpers';

const ChatContext = createContext(null);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);
  const [latestRoomUpdate, setLatestRoomUpdate] = useState(null);
  const [latestMessageError, setLatestMessageError] = useState(null);
  const [stompConnected, setStompConnected] = useState(false);
  const stompClientRef = useRef(null);
  const subscriptionsRef = useRef({});
  // ref 사용: STOMP 클로저 안에서 최신값을 읽어야 하므로 state 대신 ref
  const activeRoomIdRef = useRef(null);
  const outfitEventHandlerRef = useRef(null);
  const myUserId = user?.id ?? null;

  const setActiveRoomId = useCallback((id) => {
    activeRoomIdRef.current = id ?? null;
  }, []);

  // outfit-events 콜백 등록/해제
  const setOutfitEventHandler = useCallback((callback) => {
    outfitEventHandlerRef.current = callback;
  }, []);

  const clearOutfitEventHandler = useCallback(() => {
    outfitEventHandlerRef.current = null;
  }, []);

  // STOMP 연결 해제
  const disconnect = useCallback(() => {
    if (stompClientRef.current && stompClientRef.current.active) {
      stompClientRef.current.deactivate();
    }
    stompClientRef.current = null;
    subscriptionsRef.current = {};
  }, []);

  // 채팅방별 구독
  const subscribeToRoom = useCallback((roomId, callback) => {
    const client = stompClientRef.current;
    if (!client || !client.active) {
      return null;
    }
    const destination = `/topic/room/${roomId}`;
    const sub = client.subscribe(destination, (message) => {
      const body = replaceImageUrls(JSON.parse(message.body));
      callback(body);
    });
    subscriptionsRef.current[roomId] = sub;
    return sub;
  }, []);

  // 채팅 메시지 전송 — 미연결 시 throw (호출부에서 에러 처리 필요)
  const sendChatMessage = useCallback((roomId, payload) => {
    const client = stompClientRef.current;
    if (!client || !client.active) {
      throw new Error('채팅 서버에 연결되어 있지 않습니다.');
    }
    client.publish({
      destination: `/app/chat/rooms/${roomId}/messages`,
      body: JSON.stringify(payload),
    });
  }, []);

  // 언읽음 상태 조회
  const fetchUnreadStatus = useCallback(async () => {
    try {
      const response = await getUnreadChatStatus();
      setHasUnread(response.data?.hasUnread ?? false);
    } catch (err) {
      console.error('읽지 않은 채팅 조회 실패:', err);
    }
  }, []);

  // STOMP 연결
  useEffect(() => {
    if (!isAuthenticated || !user) {
      disconnect();
      return;
    }

    const accessToken = getAccessToken();
    if (!accessToken) {
      return;
    }

    const wsUrl = getWsUrl();

    const client = new Client({
      brokerURL: wsUrl,
      connectHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 30000,
      heartbeatOutgoing: 30000,
      onConnect: () => {
        setStompConnected(true);
        // 초기 언읽음 상태 조회
        fetchUnreadStatus();

        // 채팅방 업데이트 구독
        client.subscribe('/user/queue/chat-room-updates', (message) => {
          console.log('[WS] chat-room-updates 수신:', message.body);
          const body = JSON.parse(message.body);
          if (body.senderId === myUserId) {
            return;
          }
          // 스펙(830): 현재 해당 roomId 채팅방 내부에 있으면 red-dot 무시
          if (Number(body.roomId) === activeRoomIdRef.current) {
            return;
          }
          setHasUnread(true);
          setLatestRoomUpdate({ ...body, _ts: Date.now() });
        });

        // outfit-events 구독 (AI 코디 멀티턴)
        client.subscribe('/user/queue/outfit-events', (message) => {
          try {
            const body = replaceImageUrls(JSON.parse(message.body));
            if (outfitEventHandlerRef.current) {
              outfitEventHandlerRef.current(body);
            }
          } catch (_) {
            console.error('outfit-events 파싱 실패:', message.body);
          }
        });

        // 에러 구독 — clientMessageId로 전송 실패 전환에 사용
        client.subscribe('/user/queue/errors', (message) => {
          try {
            const body = JSON.parse(message.body);
            setLatestMessageError({ ...body, _ts: Date.now() });
          } catch (_) {
            console.error('STOMP 에러 파싱 실패:', message.body);
          }
        });
      },
      onDisconnect: () => {
        setStompConnected(false);
        console.log('STOMP 연결 해제');
      },
      onStompError: (frame) => {
        console.error('STOMP 에러:', frame);
      },
      onWebSocketError: (event) => {
        console.error('WebSocket 에러:', event);
      },
    });

    client.activate();
    stompClientRef.current = client;

    return () => {
      disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  // 읽음 상태 초기화 (채팅방 진입 시 외부에서 호출)
  const clearUnread = useCallback(() => {
    setHasUnread(false);
  }, []);

  const value = {
    hasUnread,
    latestRoomUpdate,
    latestMessageError,
    subscribeToRoom,
    sendChatMessage,
    myUserId,
    clearUnread,
    fetchUnreadStatus,
    setActiveRoomId,
    stompConnected,
    setOutfitEventHandler,
    clearOutfitEventHandler,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export default ChatContext;
