import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { Spinner } from '../components/common';
import { useToast } from '../contexts/ToastContext';
import { mockUsers, mockFeeds } from '../mocks/data';
import { formatNumber } from '../utils/helpers';
import { IoHeart, IoChatbubbleOutline } from 'react-icons/io5';
import './ProfilePage.css';

const ProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { error: showError } = useToast();

  const [user, setUser] = useState(null);
  const [feeds, setFeeds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 데이터 로드
  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      try {
        // API 연동 필요: 사용자 프로필 조회
        // const profileData = await getUserProfile(userId);
        // const feedsData = await getUserFeeds(userId);
        
        // 목업 데이터 사용
        const userData = mockUsers.find(u => u.id === userId);
        const userFeeds = mockFeeds.filter(f => f.author.id === userId);
        
        if (userData) {
          setUser(userData);
          setFeeds(userFeeds);
        }
      } catch (err) {
        showError('프로필을 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [userId, showError]);

  // 피드 상세로 이동
  const handleFeedClick = (feedId) => {
    navigate(`/feed/${feedId}`);
  };

  // 옷장 보기
  const handleClosetClick = () => {
    navigate(`/profile/${userId}/closet`);
  };

  if (isLoading) {
    return (
      <div className="profile-page">
        <Header showBack title="프로필" />
        <div className="profile-page__loading">
          <Spinner size="large" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-page">
        <Header showBack title="프로필" />
        <div className="profile-page__empty">
          <p>사용자를 찾을 수 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <Header showBack title={user.nickname} />

      <div className="profile-page__content">
        {/* 프로필 정보 */}
        <div className="profile-page__header">
          <div className="profile-page__avatar">
            {user.profileImage ? (
              <img src={user.profileImage} alt={user.nickname} />
            ) : (
              <div className="profile-page__avatar-placeholder" />
            )}
          </div>
          
          <div className="profile-page__info">
            <h2 className="profile-page__nickname">{user.nickname}</h2>
            <div className="profile-page__stats">
              <span>피드 {feeds.length}</span>
            </div>
          </div>
        </div>

        {/* 옷장 버튼 */}
        <button className="profile-page__closet-btn" onClick={handleClosetClick}>
          {user.nickname} 님의 옷장 보기
        </button>

        {/* 피드 그리드 */}
        <div className="profile-page__feeds">
          <h3 className="profile-page__feeds-title">피드</h3>
          
          {feeds.length === 0 ? (
            <div className="profile-page__feeds-empty">
              <p>아직 작성한 피드가 없습니다</p>
            </div>
          ) : (
            <div className="profile-page__feeds-grid">
              {feeds.map((feed) => (
                <div
                  key={feed.id}
                  className="profile-page__feed-card"
                  onClick={() => handleFeedClick(feed.id)}
                >
                  <div className="profile-page__feed-image">
                    {feed.images[0] ? (
                      <img src={feed.images[0]} alt="피드 이미지" />
                    ) : (
                      <div className="profile-page__feed-placeholder">사진</div>
                    )}
                    {feed.images.length > 1 && (
                      <span className="profile-page__feed-count">
                        +{feed.images.length - 1}
                      </span>
                    )}
                  </div>
                  <div className="profile-page__feed-stats">
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
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
