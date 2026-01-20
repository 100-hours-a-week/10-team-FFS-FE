import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { Button, Spinner, AlertModal, ActionSheet, Modal } from '../components/common';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { mockFeeds, mockComments, mockLikedUsers } from '../mocks/data';
import { formatDate, formatNumber } from '../utils/helpers';
import { 
  IoHeart, IoHeartOutline, IoChatbubbleOutline, 
  IoChevronBack, IoChevronForward, IoEllipsisHorizontal 
} from 'react-icons/io5';
import './FeedDetailPage.css';

const FeedDetailPage = () => {
  const { feedId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const commentInputRef = useRef(null);

  const [feed, setFeed] = useState(null);
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  
  // 댓글 관련 상태
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null); // 답글 대상
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  
  // 모달 상태
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'feed' | 'comment', id: string }

  // 데이터 로드
  useEffect(() => {
    const loadFeed = async () => {
      setIsLoading(true);
      try {
        // API 연동 필요: 피드 상세 조회
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const foundFeed = mockFeeds.find(f => f.id === feedId);
        if (foundFeed) {
          setFeed(foundFeed);
          setIsLiked(foundFeed.isLiked);
          setLikeCount(foundFeed.likeCount);
          setComments(mockComments.filter(c => c.feedId === feedId));
        } else {
          showError('피드를 찾을 수 없습니다.');
          navigate('/feed');
        }
      } catch (err) {
        showError('피드를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadFeed();
  }, [feedId, navigate, showError]);

  // 이미지 네비게이션
  const handlePrevImage = () => {
    setCurrentImageIndex(prev => 
      prev === 0 ? feed.images.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev => 
      prev === feed.images.length - 1 ? 0 : prev + 1
    );
  };

  // 좋아요 토글
  const handleLike = async () => {
    // API 연동 필요: 좋아요 API 호출
    setIsLiked(prev => !prev);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
  };

  // 댓글 작성
  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;

    setIsSubmittingComment(true);
    try {
      // API 연동 필요: 댓글 작성 API 호출
      await new Promise(resolve => setTimeout(resolve, 500));

      const newComment = {
        id: `comment_${Date.now()}`,
        feedId,
        author: user,
        content: commentText,
        likeCount: 0,
        isLiked: false,
        createdAt: new Date().toISOString(),
        replies: [],
      };

      if (replyTo) {
        // 대댓글 추가
        setComments(prev => prev.map(comment => {
          if (comment.id === replyTo.commentId) {
            return {
              ...comment,
              replies: [...comment.replies, {
                ...newComment,
                id: `reply_${Date.now()}`,
              }],
            };
          }
          return comment;
        }));
      } else {
        // 일반 댓글 추가
        setComments(prev => [...prev, newComment]);
      }

      setCommentText('');
      setReplyTo(null);
      success('댓글이 작성되었습니다.');
    } catch (err) {
      showError('댓글 작성에 실패했습니다.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // 답글 달기
  const handleReply = (comment) => {
    setReplyTo({ commentId: comment.id, nickname: comment.author.nickname });
    commentInputRef.current?.focus();
  };

  // 댓글 삭제
  const handleDeleteComment = async () => {
    if (!deleteTarget) return;

    try {
      // API 연동 필요: 댓글 삭제 API 호출
      await new Promise(resolve => setTimeout(resolve, 500));

      if (deleteTarget.type === 'comment') {
        setComments(prev => prev.filter(c => c.id !== deleteTarget.id));
      } else if (deleteTarget.type === 'reply') {
        setComments(prev => prev.map(comment => ({
          ...comment,
          replies: comment.replies.filter(r => r.id !== deleteTarget.id),
        })));
      }

      success('댓글이 삭제되었습니다.');
    } catch (err) {
      showError('댓글 삭제에 실패했습니다.');
    } finally {
      setShowDeleteModal(false);
      setDeleteTarget(null);
    }
  };

  // 피드 삭제
  const handleDeleteFeed = async () => {
    try {
      // API 연동 필요: 피드 삭제 API 호출
      await new Promise(resolve => setTimeout(resolve, 500));
      success('피드가 삭제되었습니다.');
      navigate('/feed');
    } catch (err) {
      showError('피드 삭제에 실패했습니다.');
    }
  };

  const feedActions = feed?.author?.id === user?.id ? [
    { label: '수정', onClick: () => navigate(`/feed/${feedId}/edit`) },
    { label: '삭제', onClick: () => {
      setDeleteTarget({ type: 'feed', id: feedId });
      setShowDeleteModal(true);
    }, danger: true },
  ] : [];

  if (isLoading) {
    return (
      <div className="feed-detail-page">
        <Header showBack title="피드" />
        <div className="feed-detail-page__loading">
          <Spinner size="large" />
        </div>
      </div>
    );
  }

  if (!feed) return null;

  const isMyFeed = feed.author?.id === user?.id;

  return (
    <div className="feed-detail-page">
      <Header 
        showBack 
        title="피드"
        rightAction={isMyFeed ? () => setShowActionSheet(true) : undefined}
        rightIcon={isMyFeed ? <IoEllipsisHorizontal size={24} /> : undefined}
      />

      <div className="feed-detail-page__content">
        {/* 작성자 정보 */}
        <div 
          className="feed-detail-page__author"
          onClick={() => navigate(`/profile/${feed.author.id}`)}
        >
          <div className="feed-detail-page__avatar">
            {feed.author.profileImage ? (
              <img src={feed.author.profileImage} alt={feed.author.nickname} />
            ) : (
              <div className="feed-detail-page__avatar-placeholder" />
            )}
          </div>
          <span className="feed-detail-page__nickname">{feed.author.nickname}</span>
        </div>

        {/* 이미지 슬라이더 */}
        <div className="feed-detail-page__image-section">
          <div className="feed-detail-page__image-container">
            {feed.images[currentImageIndex] ? (
              <img 
                src={feed.images[currentImageIndex]} 
                alt={`피드 이미지 ${currentImageIndex + 1}`}
                className="feed-detail-page__image"
              />
            ) : (
              <div className="feed-detail-page__image-placeholder">
                이미지 없음
              </div>
            )}

            {feed.images.length > 1 && (
              <>
                <button 
                  className="feed-detail-page__image-nav feed-detail-page__image-nav--prev"
                  onClick={handlePrevImage}
                >
                  <IoChevronBack size={24} />
                </button>
                <button 
                  className="feed-detail-page__image-nav feed-detail-page__image-nav--next"
                  onClick={handleNextImage}
                >
                  <IoChevronForward size={24} />
                </button>

                <div className="feed-detail-page__image-indicators">
                  {feed.images.map((_, index) => (
                    <span 
                      key={index}
                      className={`feed-detail-page__image-indicator ${
                        index === currentImageIndex ? 'feed-detail-page__image-indicator--active' : ''
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 액션 버튼들 */}
        <div className="feed-detail-page__actions">
          <button 
            className={`feed-detail-page__action-btn ${isLiked ? 'feed-detail-page__action-btn--liked' : ''}`}
            onClick={handleLike}
          >
            {isLiked ? <IoHeart size={24} /> : <IoHeartOutline size={24} />}
          </button>
          <button 
            className="feed-detail-page__action-btn"
            onClick={() => commentInputRef.current?.focus()}
          >
            <IoChatbubbleOutline size={24} />
          </button>
        </div>

        {/* 좋아요 수 */}
        <div 
          className="feed-detail-page__likes"
          onClick={() => setShowLikesModal(true)}
        >
          좋아요 {formatNumber(likeCount)}개
        </div>

        {/* 본문 */}
        <div className="feed-detail-page__body">
          <span className="feed-detail-page__body-author">{feed.author.nickname}</span>
          <span className="feed-detail-page__body-content">{feed.content}</span>
        </div>

        {/* 사용된 옷 */}
        {feed.clothes && feed.clothes.length > 0 && (
          <div className="feed-detail-page__clothes">
            <h3 className="feed-detail-page__clothes-title">착용 아이템</h3>
            <div className="feed-detail-page__clothes-list">
              {feed.clothes.map((item, index) => (
                <div key={index} className="feed-detail-page__clothes-item">
                  <div className="feed-detail-page__clothes-image">
                    {item.images?.[0] ? (
                      <img src={item.images[0]} alt={item.productName} />
                    ) : (
                      <div className="feed-detail-page__clothes-placeholder">사진</div>
                    )}
                  </div>
                  <span className="feed-detail-page__clothes-name">{item.productName}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 작성 시간 */}
        <div className="feed-detail-page__time">
          {formatDate(feed.createdAt)}
        </div>

        {/* 댓글 섹션 */}
        <div className="feed-detail-page__comments">
          <h3 className="feed-detail-page__comments-title">
            댓글 {comments.length}개
          </h3>

          {comments.map(comment => (
            <div key={comment.id} className="feed-detail-page__comment">
              <div className="feed-detail-page__comment-main">
                <div 
                  className="feed-detail-page__comment-avatar"
                  onClick={() => navigate(`/profile/${comment.author.id}`)}
                >
                  {comment.author.profileImage ? (
                    <img src={comment.author.profileImage} alt={comment.author.nickname} />
                  ) : (
                    <div className="feed-detail-page__comment-avatar-placeholder" />
                  )}
                </div>
                <div className="feed-detail-page__comment-content">
                  <div className="feed-detail-page__comment-header">
                    <span className="feed-detail-page__comment-author">
                      {comment.author.nickname}
                    </span>
                    <span className="feed-detail-page__comment-text">
                      {comment.content}
                    </span>
                  </div>
                  <div className="feed-detail-page__comment-meta">
                    <span>{formatDate(comment.createdAt)}</span>
                    <button onClick={() => handleReply(comment)}>답글 달기</button>
                    {comment.author.id === user?.id && (
                      <button 
                        onClick={() => {
                          setDeleteTarget({ type: 'comment', id: comment.id });
                          setShowDeleteModal(true);
                        }}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 대댓글 */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="feed-detail-page__replies">
                  {comment.replies.map(reply => (
                    <div key={reply.id} className="feed-detail-page__reply">
                      <div 
                        className="feed-detail-page__comment-avatar feed-detail-page__comment-avatar--small"
                        onClick={() => navigate(`/profile/${reply.author.id}`)}
                      >
                        {reply.author.profileImage ? (
                          <img src={reply.author.profileImage} alt={reply.author.nickname} />
                        ) : (
                          <div className="feed-detail-page__comment-avatar-placeholder" />
                        )}
                      </div>
                      <div className="feed-detail-page__comment-content">
                        <div className="feed-detail-page__comment-header">
                          <span className="feed-detail-page__comment-author">
                            {reply.author.nickname}
                          </span>
                          <span className="feed-detail-page__comment-text">
                            {reply.content}
                          </span>
                        </div>
                        <div className="feed-detail-page__comment-meta">
                          <span>{formatDate(reply.createdAt)}</span>
                          {reply.author.id === user?.id && (
                            <button 
                              onClick={() => {
                                setDeleteTarget({ type: 'reply', id: reply.id });
                                setShowDeleteModal(true);
                              }}
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 댓글 입력 */}
      <div className="feed-detail-page__comment-input">
        {replyTo && (
          <div className="feed-detail-page__reply-indicator">
            <span>@{replyTo.nickname}에게 답글 작성 중</span>
            <button onClick={() => setReplyTo(null)}>취소</button>
          </div>
        )}
        <div className="feed-detail-page__comment-input-row">
          <input
            ref={commentInputRef}
            type="text"
            placeholder={replyTo ? '답글을 입력하세요...' : '댓글을 입력하세요...'}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSubmitComment()}
          />
          <Button 
            size="small"
            onClick={handleSubmitComment}
            loading={isSubmittingComment}
            disabled={!commentText.trim()}
          >
            게시
          </Button>
        </div>
      </div>

      {/* 좋아요 목록 모달 */}
      <Modal
        isOpen={showLikesModal}
        onClose={() => setShowLikesModal(false)}
        title="좋아요"
      >
        <div className="feed-detail-page__likes-list">
          {mockLikedUsers.map(likedUser => (
            <div 
              key={likedUser.id} 
              className="feed-detail-page__likes-item"
              onClick={() => {
                setShowLikesModal(false);
                navigate(`/profile/${likedUser.id}`);
              }}
            >
              <div className="feed-detail-page__likes-avatar">
                {likedUser.profileImage ? (
                  <img src={likedUser.profileImage} alt={likedUser.nickname} />
                ) : (
                  <div className="feed-detail-page__likes-avatar-placeholder" />
                )}
              </div>
              <span>{likedUser.nickname}</span>
            </div>
          ))}
        </div>
      </Modal>

      {/* 피드 액션 시트 */}
      <ActionSheet
        isOpen={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        actions={feedActions}
      />

      {/* 삭제 확인 모달 */}
      <AlertModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteTarget(null);
        }}
        title={deleteTarget?.type === 'feed' ? '피드 삭제' : '댓글 삭제'}
        message={deleteTarget?.type === 'feed' 
          ? '이 피드를 삭제하시겠습니까?' 
          : '이 댓글을 삭제하시겠습니까?'
        }
        confirmText="삭제"
        cancelText="취소"
        onConfirm={deleteTarget?.type === 'feed' ? handleDeleteFeed : handleDeleteComment}
        danger
      />
    </div>
  );
};

export default FeedDetailPage;
