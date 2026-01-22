import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { FeedCardSkeleton } from '../components/common';
import { useAuth } from '../contexts/AuthContext';
import { mockFeeds } from '../mocks/data';
import { formatNumber } from '../utils/helpers';
import { IoHeart, IoChatbubbleOutline, IoSettingsOutline } from 'react-icons/io5';
import './MyPage.css';

const MyPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [feeds, setFeeds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 내 피드 로드
  useEffect(() => {
    const loadMyFeeds = async () => {
      setIsLoading(true);
      try {
        // API 연동 필요: 내 피드 목록 조회
        // const data = await getUserFeeds(user.id);
        
        // 목업 데이터 사용
        const myFeeds = mockFeeds.filter(f => f.author.id === user?.id);
        setFeeds(myFeeds);
      } catch (err) {
        console.error('Failed to load feeds:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadMyFeeds();
    }
  }, [user]);

  // 피드 상세로 이동
  const handleFeedClick = (feedId) => {
    navigate(`/feed/${feedId}`);
  };

  // 설정 페이지로 이동
  const handleSettingsClick = () => {
    navigate('/mypage/edit');
  };

  // 옷장으로 이동
  const handleClosetClick = () => {
    navigate('/closet');
  };

  return (
    <div className="my-page">
      <Header 
        title="마이페이지"
        rightAction={handleSettingsClick}
        rightIcon={<IoSettingsOutline size={24} />}
      />

      <div className="my-page__content">
        {/* 프로필 정보 */}
        <div className="my-page__profile">
          <div className="my-page__avatar">
            {user?.profileImage ? (
              <img src={user.profileImage} alt={user.nickname} />
            ) : (
              <div className="my-page__avatar-placeholder" />
            )}
          </div>
          
          <div className="my-page__info">
            <h2 className="my-page__nickname">{user?.nickname || '사용자'}</h2>
            <div className="my-page__stats">
              <span>피드 {feeds.length}</span>
            </div>
          </div>
        </div>

        {/* 버튼 영역 */}
        <div className="my-page__buttons">
          <button className="my-page__btn" onClick={() => navigate('/mypage/edit')}>
            프로필 편집
          </button>
          <button className="my-page__btn" onClick={handleClosetClick}>
            내 옷장
          </button>
        </div>

        {/* 피드 그리드 */}
        <div className="my-page__feeds">
          <h3 className="my-page__feeds-title">내 피드</h3>
          
          {isLoading ? (
            <div className="my-page__feeds-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <FeedCardSkeleton key={index} />
              ))}
            </div>
          ) : feeds.length === 0 ? (
            <div className="my-page__feeds-empty">
              <p>아직 작성한 피드가 없습니다</p>
              <button onClick={() => navigate('/feed/create')}>
                첫 피드 작성하기
              </button>
            </div>
          ) : (
            <div className="my-page__feeds-grid">
              {feeds.map((feed) => (
                <div
                  key={feed.id}
                  className="my-page__feed-card"
                  onClick={() => handleFeedClick(feed.id)}
                >
                  <div className="my-page__feed-image">
                    {feed.images[0] ? (
                      <img src={feed.images[0]} alt="피드 이미지" />
                    ) : (
                      <div className="my-page__feed-placeholder">사진</div>
                    )}
                    {feed.images.length > 1 && (
                      <span className="my-page__feed-count">
                        +{feed.images.length - 1}
                      </span>
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
          )}
        </div>
      </div>
    </div>
  );
};

export default MyPage;
