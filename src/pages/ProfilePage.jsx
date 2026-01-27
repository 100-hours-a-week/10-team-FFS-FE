import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../components/layout';
import { FeedCardSkeleton, Spinner } from '../components/common';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getUserProfile, getUserFeeds } from '../api';
import { formatNumber } from '../utils/helpers';
import { IoHeart, IoChatbubbleOutline, IoSettingsOutline } from 'react-icons/io5';
import './MyPage.css';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { userId } = useParams(); // URL에서 userId 가져오기
  const { user: currentUser } = useAuth();
  const { error: showError } = useToast();

  const [profile, setProfile] = useState(null);
  const [feeds, setFeeds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFeedsLoading, setIsFeedsLoading] = useState(false);
  const [feedsCursor, setFeedsCursor] = useState(null);
  const [hasMoreFeeds, setHasMoreFeeds] = useState(false);

  // 프로필 & 피드 로드
  useEffect(() => {
    const loadProfileData = async () => {
      setIsLoading(true);
      try {
        // 프로필 조회
        const profileResponse = await getUserProfile(userId);
        const profileData = profileResponse.data;
        
        setProfile({
          id: profileData.userProfile.userId,
          profileImage: profileData.userProfile.userProfileImageUrl,
          nickname: profileData.userProfile.nickname,
          isMe: profileData.isMe,
          followerCount: profileData.followerCount || 0,
          followingCount: profileData.followingCount || 0,
        });

        // 피드 목록 조회
        await loadFeeds();
      } catch (err) {
        console.error('Failed to load profile:', err);
        if (err.message === 'target_user_not_found' || err.message === 'user_not_found') {
          showError('사용자를 찾을 수 없습니다.');
          navigate(-1);
        } else {
          showError('프로필을 불러오는데 실패했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      loadProfileData();
    }
  }, [userId, navigate, showError]);

  // 피드 목록 로드
  const loadFeeds = useCallback(async (cursor = null) => {
    try {
      const response = await getUserFeeds(userId, cursor, 20);
      const { items, pageInfo } = response.data;

      const mappedFeeds = items.map(item => ({
        id: item.feedId,
        primaryImageUrl: item.primaryImageUrl,
        likeCount: item.likeCount,
        commentCount: item.commentCount,
        isLiked: item.isLiked,
      }));

      if (cursor) {
        setFeeds(prev => [...prev, ...mappedFeeds]);
      } else {
        setFeeds(mappedFeeds);
      }

      setFeedsCursor(pageInfo.nextCursor);
      setHasMoreFeeds(pageInfo.hasNextPage);
    } catch (err) {
      console.error('Failed to load feeds:', err);
    }
  }, [userId]);

  // 더 많은 피드 로드
  const handleLoadMoreFeeds = async () => {
    if (isFeedsLoading || !hasMoreFeeds) return;
    setIsFeedsLoading(true);
    await loadFeeds(feedsCursor);
    setIsFeedsLoading(false);
  };

  // 피드 상세로 이동
  const handleFeedClick = (feedId) => {
    navigate(`/feed/${feedId}`);
  };

  // 설정 페이지로 이동
  const handleSettingsClick = () => {
    navigate('/mypage/edit');
  };

  // 내 옷장으로 이동
  const handleMyClosetClick = () => {
    navigate('/closet');
  };
  // 남의 옷장으로 이동
  const handleClosetClick = () => {
    navigate(`/closet/${userId}`);
  };

  if (isLoading) {
    return (
      <div className="my-page">
        <Header showBack title="프로필" />
        <div className="my-page__loading">
          <Spinner size="large" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="my-page">
      <Header 
        showBack={!profile.isMe}
        title={profile.isMe ? '마이페이지' : '프로필'}
        rightAction={profile.isMe ? handleSettingsClick : undefined}
        rightIcon={profile.isMe ? <IoSettingsOutline size={24} /> : undefined}
      />

      <div className="my-page__content">
        {/* 프로필 정보 */}
        <div className="my-page__profile">
          <div className="my-page__avatar">
            {profile.profileImage ? (
              <img src={profile.profileImage} alt={profile.nickname} />
            ) : (
              <div className="my-page__avatar-placeholder" />
            )}
          </div>
          
          <div className="my-page__info">
            <h2 className="my-page__nickname">{profile.nickname}</h2>
            <div className="my-page__stats">
              <span>피드 {feeds.length}</span>
              {/* <span>팔로워 {formatNumber(profile.followerCount)}</span>
              <span>팔로잉 {formatNumber(profile.followingCount)}</span> */ }
            </div>
          </div>
        </div>

        {/* 버튼 영역 - 내 프로필일 때만 표시 */}
        {profile.isMe ? (
          <div className="my-page__buttons">
            <button className="my-page__btn" onClick={() => navigate('/mypage/edit')}>
              프로필 편집
            </button>
            <button className="my-page__btn" onClick={handleMyClosetClick}>
              내 옷장 보러가기
            </button>
          </div>
        ):(
          <div className="my-page__buttons">
            <button className="my-page__btn" onClick={handleClosetClick}>
              옷장 구경하러 가기
            </button>
          </div>

        )}

        {/* 피드 그리드 */}
        <div className="my-page__feeds">
          
          
          {feeds.length === 0 ? (
            <div className="my-page__feeds-empty">
              <p>
                {profile.isMe 
                  ? '아직 작성한 피드가 없습니다' 
                  : '아직 작성한 피드가 없습니다'
                }
              </p>
              {profile.isMe && (
                <button onClick={() => navigate('/feed/create')}>
                  첫 피드 작성하기
                </button>
              )}
            </div>
          ) : (
            <>
              <h3 className="my-page__feeds-title">
                {profile.isMe ? '내 피드' : '피드'}
              </h3>
              <div className="my-page__feeds-grid">
                {feeds.map((feed) => (
                  <div
                    key={feed.id}
                    className="my-page__feed-card"
                    onClick={() => handleFeedClick(feed.id)}
                  >
                    <div className="my-page__feed-image">
                      {feed.primaryImageUrl ? (
                        <img src={feed.primaryImageUrl} alt="피드 이미지" />
                      ) : (
                        <div className="my-page__feed-placeholder">사진</div>
                      )}
                    </div>
                    <div className="my-page__feed-stats">
                      <span>
                        <IoHeart size={12} />
                        {formatNumber(feed.likeCount)}
                      </span>
                      <span>
                        <IoChatbubbleOutline size={12} />
                        {formatNumber(feed.commentCount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 피드 더보기 버튼 */}
              {hasMoreFeeds && (
                <button 
                  className="my-page__load-more"
                  onClick={handleLoadMoreFeeds}
                  disabled={isFeedsLoading}
                >
                  {isFeedsLoading ? '로딩 중...' : '더보기'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;