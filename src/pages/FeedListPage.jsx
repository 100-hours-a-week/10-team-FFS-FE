import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import { getFeeds } from '../api';
import FeedList from './FeedList';

const FeedListPage = () => {
  const navigate = useNavigate();

  const fetchFeeds = useCallback(async (cursor) => {
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

  const { data: feeds, isLoading, lastElementRef } =
    useInfiniteScroll(fetchFeeds, { threshold: 300 });

  return (
    <div className="feed-list-page">
      <Header title="피드" />

      <div className="feed-list-page__content">
        {feeds.length === 0 && !isLoading ? (
          <div className="feed-list-page__empty">
            <p>아직 피드가 없습니다</p>
          </div>
        ) : (
          <FeedList
            feeds={feeds}
            isLoading={isLoading}
            lastElementRef={lastElementRef}
            onFeedClick={(feedId) => navigate(`/feed/${feedId}`)}
          />
        )}
      </div>
    </div>
  );
};

export default FeedListPage;
