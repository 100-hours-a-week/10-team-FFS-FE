import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { FeedCardSkeleton } from '../components/common';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import { mockFeeds } from '../mocks/data';
import { formatNumber } from '../utils/helpers';
import { IoHeart } from 'react-icons/io5';
import { IoChatbubbleOutline } from 'react-icons/io5';
import './FeedListPage.css';

const FeedListPage = () => {
  const navigate = useNavigate();

  // API 연동 필요: 피드 목록 조회
  const fetchFeeds = useCallback(async (cursor) => {
    // 목업 데이터 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const startIndex = cursor ? mockFeeds.findIndex(f => f.id === cursor) + 1 : 0;
    const pageData = mockFeeds.slice(startIndex, startIndex + 12);
    
    return {
      data: pageData,
      nextCursor: pageData.length > 0 ? pageData[pageData.length - 1].id : null,
      hasMore: startIndex + 12 < mockFeeds.length,
    };
  }, []);

  const { 
    data: feeds, 
    isLoading, 
    lastElementRef 
  } = useInfiniteScroll(fetchFeeds, { threshold: 300 });

  // 피드 상세로 이동
  const handleFeedClick = (feedId) => {
    navigate(`/feed/${feedId}`);
  };

  return (
    <div className="feed-list-page">
      <Header title="피드" />

      <div className="feed-list-page__content">
        {feeds.length === 0 && !isLoading ? (
          <div className="feed-list-page__empty">
            <p>아직 피드가 없습니다</p>
          </div>
        ) : (
          <div className="feed-list-page__grid">
            {feeds.map((feed, index) => (
              <div
                key={feed.id}
                ref={index === feeds.length - 1 ? lastElementRef : null}
                className="feed-list-page__item"
                onClick={() => handleFeedClick(feed.id)}
              >
                <div className="feed-list-page__item-image">
                  {feed.images[0] ? (
                    <img src={feed.images[0]} alt="피드 이미지" />
                  ) : (
                    <div className="feed-list-page__item-placeholder">
                      사진
                    </div>
                  )}
                  
                  {/* 여러 이미지 표시 */}
                  {feed.images.length > 1 && (
                    <div className="feed-list-page__item-multi">
                      <span>+{feed.images.length - 1}</span>
                    </div>
                  )}
                </div>

                {/* 피드 정보 */}
                <div className="feed-list-page__item-info">
                  <div className="feed-list-page__item-author">
                    <div className="feed-list-page__item-avatar">
                      {feed.author.profileImage ? (
                        <img src={feed.author.profileImage} alt={feed.author.nickname} />
                      ) : (
                        <div className="feed-list-page__item-avatar-placeholder" />
                      )}
                    </div>
                    <span className="feed-list-page__item-nickname">
                      {feed.author.nickname}
                    </span>
                  </div>
                  
                  <div className="feed-list-page__item-stats">
                    <span className="feed-list-page__item-stat">
                      <IoHeart size={14} />
                      {formatNumber(feed.likeCount)}
                    </span>
                    <span className="feed-list-page__item-stat">
                      <IoChatbubbleOutline size={14} />
                      {formatNumber(feed.commentCount)}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* 로딩 스켈레톤 */}
            {isLoading && (
              <>
                {Array.from({ length: 6 }).map((_, index) => (
                  <FeedCardSkeleton key={`skeleton-${index}`} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedListPage;
