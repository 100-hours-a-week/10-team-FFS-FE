import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../components/layout';
import { Spinner } from '../components/common';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getUserProfile, getUserFeeds } from '../api';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import FeedList from './FeedList';
import './ProfilePage.css';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const { error: showError } = useToast();

  const [profile, setProfile] = useState(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // 프로필 조회
  useEffect(() => {
    const loadProfile = async () => {
      setIsProfileLoading(true);
      try {
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
      } catch (err) {
        console.error('Failed to load profile:', err);
        if (err.message === 'target_user_not_found' || err.message === 'user_not_found') {
          showError('사용자를 찾을 수 없습니다.');
          navigate(-1);
        } else {
          showError('프로필을 불러오는데 실패했습니다.');
        }
      } finally {
        setIsProfileLoading(false);
      }
    };

    if (userId) loadProfile();
  }, [userId, navigate, showError]);

  // 프로필 피드 무한 스크롤 fetch 함수
  const fetchUserFeeds = useCallback(async (cursor) => {
    const response = await getUserFeeds(userId, cursor, 12);
    const { items, pageInfo } = response.data;

    return {
      data: items.map((item) => ({
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
  }, [userId]);

  const {
    data: feeds,
    isLoading: isFeedsLoading,
    lastElementRef,
    reset,
    loadMore,
  } = useInfiniteScroll(fetchUserFeeds, { threshold: 300, initialLoad: false });

  useEffect(() => {
    if (!userId) return;
    reset();
    setTimeout(() => loadMore(), 0);
  }, [userId, reset]);

  // 설정 페이지로 이동
  const handleSettingsClick = () => navigate('/mypage/edit');

  // 남의 옷장으로 이동
  const handleClosetClick = () => navigate(`/closet/${userId}`);

  if (isProfileLoading) {
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
        rightIcon={profile.isMe ? <span /> : undefined}
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
            </div>
          </div>
        </div>

        {/* 버튼 영역 */}
          <div className="my-page__buttons">
            {profile.isMe &&(
              <button className="my-page__btn" onClick={() => navigate('/mypage/edit')}>
                계정 관리
              </button>
            )}
            <button className="my-page__btn" onClick={handleClosetClick}>
              옷장 구경하러 가기
            </button>
          </div>

        {/* ✅ FeedList로 통일 + 무한 스크롤 */}
        <div className="my-page__feeds">
          {feeds.length === 0 && !isFeedsLoading ? (
            <div className="my-page__feeds-empty">
              <p>아직 작성한 피드가 없습니다</p>
              {profile.isMe && (
                <button onClick={() => navigate('/feed/create')}>
                  첫 피드 작성하기
                </button>
              )}
            </div>
          ) : (
            <FeedList
              feeds={feeds}
              isLoading={isFeedsLoading}
              lastElementRef={lastElementRef}
              onFeedClick={(feedId) => navigate(`/feed/${feedId}`)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
