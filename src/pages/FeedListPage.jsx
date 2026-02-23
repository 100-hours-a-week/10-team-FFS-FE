import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { ScrollToTopButton } from '../components/common';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import { getFeeds, getFollowingFeeds } from '../api';
import FeedList from './FeedList';
import './FeedListPage.css';


const FeedListPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'following'

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
    if (tab === activeTab) return;
    setActiveTab(tab);

    // 팔로잉 탭을 처음 누를 때만 로드
    if (tab === 'following' && followingFeeds.data.length === 0) {
      followingFeeds.loadMore();
    }
  };
  const currentFeeds = activeTab === 'all' ? allFeeds : followingFeeds;

  const { data: feeds, isLoading, lastElementRef } =
    useInfiniteScroll(fetchAllFeeds, { threshold: 300 });


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

  return (
    <div className="feed-list-page">
      <Header title="피드" />

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
    </div>
  );
};

export default FeedListPage;
