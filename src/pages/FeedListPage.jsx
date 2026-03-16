import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import transparentLogo from '../assets/transparent_logo.png';
import { ScrollToTopButton, LoginPromptModal } from '../components/common';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import { getFeeds, getFollowingFeeds } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useChatContext } from '../contexts/ChatContext';
import { IoPaperPlaneOutline, IoLogInOutline } from 'react-icons/io5';
import FeedList from './FeedList';
import './FeedListPage.css';


const FeedListPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { hasUnread } = useChatContext();
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'following'
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalMessage, setLoginModalMessage] = useState('');

  const requireLogin = (message) => {
    setLoginModalMessage(message);
    setShowLoginModal(true);
  };

  const fetchAllFeeds = useCallback(async (cursor) => {
    const response = await getFeeds(cursor, 12);
    const { items, pageInfo } = response.data;

    return {
      data: items.map(item => ({
        id: item.feedId,
        primaryImageUrl: item.primaryImageUrl,
        likeCount: item.likeCount,
        commentCount: item.commentCount,
        author: {
          id: item.userProfile.userId,
          profileImage: item.userProfile.userProfileImageUrl,
          nickname: item.userProfile.nickname,
        },
        isLiked: item.isLiked,
      })),
      nextCursor: pageInfo.hasNextPage ? pageInfo.nextCursor : null,
      hasMore: pageInfo.hasNextPage,
    };
  }, []);

  const fetchFollowingFeeds = useCallback(async (cursor) => {
    const response = await getFollowingFeeds(cursor, 12);
    const { items, pageInfo } = response.data;

    return {
      data: items.map(item => mapFeedItem(item)),
      nextCursor: pageInfo.hasNextPage ? pageInfo.nextCursor : null,
      hasMore: pageInfo.hasNextPage,
    };
  }, []);

  const allFeeds = useInfiniteScroll(fetchAllFeeds, { threshold: 300 });
  const followingFeeds = useInfiniteScroll(fetchFollowingFeeds, {
    threshold: 300,
    initialLoad: false,
  });

  const handleTabChange = (tab) => {
    if (tab === activeTab) {
      return;
    }

    // 비회원은 팔로잉 탭 접근 불가
    if (tab === 'following' && !isAuthenticated) {
      requireLogin('팔로잉 피드를 보려면 로그인이 필요합니다.');
      return;
    }

    setActiveTab(tab);

    // 팔로잉 탭을 처음 누를 때만 로드
    if (tab === 'following' && followingFeeds.data.length === 0) {
      followingFeeds.loadMore();
    }
  };
  const currentFeeds = activeTab === 'all' ? allFeeds : followingFeeds;

  const mapFeedItem = (item) => ({
    id: item.feedId,
    primaryImageUrl: item.primaryImageUrl,
    likeCount: item.likeCount,
    commentCount: item.commentCount,
    author: {
      id: item.userProfile.userId,
      profileImage: item.userProfile.userProfileImageUrl,
      nickname: item.userProfile.nickname,
    },
    isLiked: item.isLiked,
  });

  // 헤더 우상단 요소: 회원은 DM 아이콘, 비회원은 로그인 아이콘
  const renderHeaderRight = () => {
    if (isAuthenticated) {
      return (
        <button
          className="feed-list-page__header-btn"
          onClick={() => navigate('/dm')}
        >
          <IoPaperPlaneOutline size={24} />
          {hasUnread && <span className="feed-list-page__dm-dot" />}
        </button>
      );
    }

    return (
      <button
        className="feed-list-page__header-btn"
        onClick={() => navigate('/login')}
      >
        <IoLogInOutline size={24} />
      </button>
    );
  };

  return (
    <div className="feed-list-page">
      <Header
        titleElement={
          <div className="feed-list-page__header-logo">
            <img src={transparentLogo} alt="KlosetLab" className="feed-list-page__header-logo-img" />
            <span className="feed-list-page__header-logo-text">KlosetLab</span>
          </div>
        }
        rightElement={renderHeaderRight()}
      />

      {/* 탭 */}
      <div className="feed-list-page__tabs">
        <button
          className={`feed-list-page__tab ${activeTab === 'all' ? 'feed-list-page__tab--active' : ''}`}
          onClick={() => handleTabChange('all')}
        >
          전체
        </button>
        <button
          className={`feed-list-page__tab ${activeTab === 'following' ? 'feed-list-page__tab--active' : ''}`}
          onClick={() => handleTabChange('following')}
        >
          팔로잉
        </button>
      </div>

      <div className="feed-list-page__content">
        {currentFeeds.data.length === 0 && !currentFeeds.isLoading ? (
          <div className="feed-list-page__empty">
            <p>
              {activeTab === 'all'
                ? '아직 피드가 없습니다'
                : '팔로잉한 사람의 피드가 없습니다'}
            </p>
          </div>
        ) : (
          <FeedList
            feeds={currentFeeds.data}
            isLoading={currentFeeds.isLoading}
            lastElementRef={currentFeeds.lastElementRef}
            onFeedClick={(feedId) => navigate(`/feed/${feedId}`)}
          />
        )}
      </div>

      <ScrollToTopButton />

      <LoginPromptModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        message={loginModalMessage}
      />
    </div>
  );
};

export default FeedListPage;