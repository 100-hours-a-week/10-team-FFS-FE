import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../components/layout';
import { Spinner, Modal, Button, LoginPromptModal } from '../components/common';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getUserProfile, getUserFeeds, followUser, unfollowUser, getFollowings, getFollowers, createChatRoom } from '../api';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import FeedList from './FeedList';
import './ProfilePage.css';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { user: currentUser, isAuthenticated } = useAuth();
  const { error: showError } = useToast();

  const [profile, setProfile] = useState(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // 팔로우 목록 모달 상태
  const [modalType, setModalType] = useState(null); // 'following' | 'followers' | null
  const [followList, setFollowList] = useState([]);
  const [followCursor, setFollowCursor] = useState(null);
  const [hasMoreFollow, setHasMoreFollow] = useState(false);
  const [isLoadingFollow, setIsLoadingFollow] = useState(false);
  const [followSort, setFollowSort] = useState('timeDesc'); // 'timeDesc' | 'timeAsc'

  // 로그인 유도 모달
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalMessage, setLoginModalMessage] = useState('');

  const requireLogin = (message) => {
    setLoginModalMessage(message);
    setShowLoginModal(true);
  };

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
        setIsFollowing(profileData.isFollowing || false);
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

    if (userId) {
      loadProfile();
    }
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
    if (!userId) {
      return;
    }
    reset();
    setTimeout(() => loadMore(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // 팔로우 / 언팔로우
  const handleToggleFollow = async () => {
    if (!isAuthenticated) {
      requireLogin('팔로우하려면 로그인이 필요합니다.');
      return;
    }
    if (isFollowLoading) {
      return;
    }
    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(userId);
        setIsFollowing(false);
        setProfile(prev => ({
          ...prev,
          followerCount: Math.max(0, prev.followerCount - 1),
        }));
      } else {
        await followUser(userId);
        setIsFollowing(true);
        setProfile(prev => ({
          ...prev,
          followerCount: prev.followerCount + 1,
        }));
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      if (err.message === 'already_following') {
        showError('이미 팔로우한 유저입니다.');
      } else {
        showError('팔로우 처리에 실패했습니다.');
      }
    } finally {
      setIsFollowLoading(false);
    }
  };

  // 팔로우 목록 로드
  const loadFollowList = async (type, cursor = null, sort = followSort) => {
    setIsLoadingFollow(true);
    try {
      const response = type === 'following'
        ? await getFollowings(userId, cursor, 20, sort)
        : await getFollowers(userId, cursor, 20, sort);

      const { items, pageInfo } = response.data;

      const mappedUsers = items.map(item => ({
        id: item.userProfile.userId,
        profileImage: item.userProfile.userProfileImageUrl,
        nickname: item.userProfile.nickname,
        isFollowing: item.isFollowing,
      }));

      if (cursor) {
        setFollowList(prev => [...prev, ...mappedUsers]);
      } else {
        setFollowList(mappedUsers);
      }

      setFollowCursor(pageInfo.nextCursor);
      setHasMoreFollow(pageInfo.hasNextPage);
    } catch (err) {
      console.error('Failed to load follow list:', err);
      showError('목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoadingFollow(false);
    }
  };

  // 모달 열기
  const handleOpenFollowModal = (type) => {
    setModalType(type);
    setFollowList([]);
    setFollowCursor(null);
    setFollowSort('timeDesc');
    loadFollowList(type, null, 'timeDesc');
  };

  const handleSortChange = (newSort) => {
    if (newSort === followSort) {
      return;
    }
    setFollowSort(newSort);
    setFollowList([]);
    setFollowCursor(null);
    loadFollowList(modalType, null, newSort);
  };

  // 모달 내 팔로우 토글
  const handleToggleFollowInList = async (targetUserId) => {
    if (!isAuthenticated) {
      requireLogin('팔로우하려면 로그인이 필요합니다.');
      return;
    }
    const targetUser = followList.find(u => u.id === targetUserId);
    if (!targetUser) {
      return;
    }

    try {
      if (targetUser.isFollowing) {
        await unfollowUser(targetUserId);
      } else {
        await followUser(targetUserId);
      }

      setFollowList(prev => prev.map(u => {
        if (u.id === targetUserId) {
          return { ...u, isFollowing: !u.isFollowing };
        }
        return u;
      }));

      // 프로필 카운트 동기화 (내 프로필인 경우)
      if (profile.isMe) {
        setProfile(prev => ({
          ...prev,
          followingCount: targetUser.isFollowing
            ? Math.max(0, prev.followingCount - 1)
            : prev.followingCount + 1,
        }));
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      showError('팔로우 처리에 실패했습니다.');
    }
  };

  // 메시지 보내기
  const handleSendMessage = async () => {
    if (!isAuthenticated) {
      requireLogin('메시지를 보내려면 로그인이 필요합니다.');
      return;
    }
    try {
      const response = await createChatRoom(Number(userId));
      const roomId = response.data.roomId;
      navigate(`/dm/${roomId}`, {
        state: {
          opponent: {
            userId: profile.id,
            nickname: profile.nickname,
            profileImageUrl: profile.profileImage,
          },
          unreadCount: 0,
        },
      });
    } catch (err) {
      console.error('채팅방 생성 실패:', err);
      showError('채팅방을 열 수 없습니다.');
    }
  };

  // 설정 페이지로 이동
  const handleSettingsClick = () => navigate('/mypage/edit');

  // 옷장으로 이동
  const handleClosetClick = () => {
    if (!isAuthenticated) {
      requireLogin('옷장을 보려면 로그인이 필요합니다.');
      return;
    }
    navigate(`/closet/${userId}`);
  };

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
            <div className="my-page__info-header">
              <h2 className="my-page__nickname">{profile.nickname}</h2>
              {!profile.isMe && (
                <Button
                  size="small"
                  variant={isFollowing ? 'secondary' : 'primary'}
                  onClick={handleToggleFollow}
                  disabled={isFollowLoading}
                  style={{ marginRight: 'var(--spacing-xs)' }}
                >
                  {isFollowLoading ? '' : isFollowing ? '팔로잉' : '팔로우'}
                </Button>
              )}
            </div>
            <div className="my-page__stats">
              <span style={{ marginRight: '20px' }}>피드 {feeds.length}</span>
              <span
                onClick={() => handleOpenFollowModal('following')}
                style={{ marginRight: '20px', cursor: 'pointer' }}
              >
                팔로잉 {profile.followingCount}
              </span>
              <span
                onClick={() => handleOpenFollowModal('followers')}
                style={{ cursor: 'pointer' }}
              >
                팔로워 {profile.followerCount}
              </span>
            </div>
          </div>
        </div>

        {/* 버튼 영역 */}
        <div className="my-page__buttons">
          {profile.isMe ? (
            <button className="my-page__btn" onClick={() => navigate('/mypage/edit')}>
              계정 관리
            </button>
          ) : (
            <button className="my-page__btn" onClick={handleSendMessage}>
              메시지 보내기
            </button>
          )}
          <button className="my-page__btn" onClick={handleClosetClick}>
            옷장 구경하러 가기
          </button>
        </div>

        {/* 피드 목록 */}
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

        {/* 팔로잉/팔로워 목록 모달 */}
        <Modal
          isOpen={modalType !== null}
          onClose={() => setModalType(null)}
          title={modalType === 'following' ? '팔로잉' : '팔로워'}
        >
          <div className="follow-modal__list">
            <div className="follow-modal__tabs">
              <button
                className={`follow-modal__tab ${followSort === 'timeDesc' ? 'follow-modal__tab--active' : ''}`}
                onClick={() => handleSortChange('timeDesc')}
              >
                최신순
              </button>
              <button
                className={`follow-modal__tab ${followSort === 'timeAsc' ? 'follow-modal__tab--active' : ''}`}
                onClick={() => handleSortChange('timeAsc')}
              >
                오래된순
              </button>
            </div>
            {isLoadingFollow && followList.length === 0 ? (
              <div className="follow-modal__loading">
                <Spinner size="small" />
              </div>
            ) : followList.length === 0 ? (
              <div className="follow-modal__empty">
                {modalType === 'following' ? '팔로잉하는 사람이 없습니다.' : '팔로워가 없습니다.'}
              </div>
            ) : (
              <>
                {followList.map(followedUser => (
                  <div
                    key={followedUser.id}
                    className="follow-modal__item"
                  >
                    <div
                      className="follow-modal__user-info"
                      onClick={() => {
                        setModalType(null);
                        navigate(`/profile/${followedUser.id}`);
                      }}
                    >
                      <div className="follow-modal__avatar">
                        {followedUser.profileImage ? (
                          <img src={followedUser.profileImage} alt={followedUser.nickname} />
                        ) : (
                          <div className="follow-modal__avatar-placeholder" />
                        )}
                      </div>
                      <span>{followedUser.nickname}</span>
                    </div>
                    {followedUser.id !== currentUser?.id && (
                      <Button
                        size="small"
                        variant={followedUser.isFollowing ? 'secondary' : 'primary'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFollowInList(followedUser.id);
                        }}
                      >
                        {followedUser.isFollowing ? '팔로잉' : '팔로우'}
                      </Button>
                    )}
                  </div>
                ))}

                {hasMoreFollow && (
                  <button
                    className="follow-modal__load-more"
                    onClick={() => loadFollowList(modalType, followCursor)}
                    disabled={isLoadingFollow}
                  >
                    {isLoadingFollow ? '로딩 중...' : '더보기'}
                  </button>
                )}
              </>
            )}
          </div>
        </Modal>
      </div>

      {/* 로그인 유도 모달 */}
      <LoginPromptModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        message={loginModalMessage}
      />
    </div>
  );
};

export default ProfilePage;