import React from 'react';
import { FeedCardSkeleton } from '../components/common';
import { formatNumber } from '../utils/helpers';
import { IoHeart, IoChatbubbleOutline } from 'react-icons/io5';
import './FeedListPage.css';

const FeedList = ({ feeds, isLoading, lastElementRef, onFeedClick }) => {
  return (
    <div className="feed-list-page__grid">
      {feeds.map((feed, index) => (
        <div
          key={feed.id}
          ref={index === feeds.length - 1 ? lastElementRef : null}
          className="feed-list-page__item"
          onClick={() => onFeedClick(feed.id)}
        >
          <div className="feed-list-page__item-image">
            {feed.primaryImageUrl ? (
              <img src={feed.primaryImageUrl} alt="피드 이미지" />
            ) : (
              <div className="feed-list-page__item-placeholder">사진</div>
            )}
          </div>

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
              <span className={`feed-list-page__item-stat ${feed.isLiked ? 'feed-list-page__item-stat--liked' : ''}`}>
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

      {isLoading && (
        <>
          {Array.from({ length: 6 }).map((_, index) => (
            <FeedCardSkeleton key={`skeleton-${index}`} />
          ))}
        </>
      )}
    </div>
  );
};

export default FeedList;
