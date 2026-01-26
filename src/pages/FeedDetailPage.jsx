import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { Button, Spinner, AlertModal, ActionSheet, Modal } from '../components/common';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { 
  getFeedDetail, 
  likeFeed, 
  unlikeFeed, 
  getFeedLikes,
  deleteFeed,
  getComments,
  getReplies,
  createComment,
  deleteComment,
  likeComment,
  unlikeComment
} from '../api';
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
  const [replyTo, setReplyTo] = useState(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentsCursor, setCommentsCursor] = useState(null);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [isLoadingMoreComments, setIsLoadingMoreComments] = useState(false);
  const [loadingRepliesFor, setLoadingRepliesFor] = useState(null); // 대댓글 로딩 중인 댓글 ID
  
  // 좋아요 목록 관련 상태
  const [likedUsers, setLikedUsers] = useState([]);
  const [likesCursor, setLikesCursor] = useState(null);
  const [hasMoreLikes, setHasMoreLikes] = useState(false);
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);
  
  // 모달 상태
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // 피드 데이터 로드
  useEffect(() => {
    const loadFeed = async () => {
      setIsLoading(true);
      try {
        const response = await getFeedDetail(feedId);
        const data = response.data;
        
        setFeed({
          id: data.feedId,
          images: data.imageUrls,
          content: data.content,
          postedTime: data.postedTime,
          clothes: data.clothes?.map(c => ({
            id: c.id,
            imageUrl: c.imageUrl,
            productName: c.name,
            price: c.price,
          })) || [],
          author: {
            id: data.userProfile.userId,
            profileImage: data.userProfile.userProfileImageUrl,
            nickname: data.userProfile.nickname,
          },
          isOwner: data.isOwner,
          isFollowing: data.isFollowing,
        });
        setIsLiked(data.isLiked);
        setLikeCount(data.likeCount);
        
        // 댓글 로드
        await loadComments();
      } catch (err) {
        console.error('Failed to load feed:', err);
        if (err.message === 'feed_not_found') {
          showError('피드를 찾을 수 없습니다.');
        } else {
          showError('피드를 불러오는데 실패했습니다.');
        }
        navigate('/feed');
      } finally {
        setIsLoading(false);
      }
    };

    loadFeed();
  }, [feedId, navigate, showError]);

  // 댓글 로드
  const loadComments = useCallback(async (cursor = null) => {
    try {
      const response = await getComments(feedId, cursor, 20);
      const { items, pageInfo } = response.data;
      
      const mappedComments = items.map(item => ({
        id: item.commentId,
        content: item.content,
        likeCount: item.likeCount,
        isLiked: item.isLiked,
        isOwner: item.isOwner,
        modifiedAt: item.modifiedAt,
        author: {
          id: item.userProfile.userId,
          profileImage: item.userProfile.userProfileImageUrl,
          nickname: item.userProfile.nickname,
        },
        // 대댓글 관련 정보
        replyInfo: item.replyInfo || { hasReplies: false, replyCount: 0 },
        replies: [],
        repliesLoaded: false, // 대댓글을 한 번이라도 로드했는지
        repliesCursor: null,
        hasMoreReplies: false,
      }));
      
      if (cursor) {
        setComments(prev => [...prev, ...mappedComments]);
      } else {
        setComments(mappedComments);
      }
      
      setCommentsCursor(pageInfo.nextCursor);
      setHasMoreComments(pageInfo.hasNextPage);
    } catch (err) {
      console.error('Failed to load comments:', err);
    }
  }, [feedId]);

  // 대댓글 로드
  const loadReplies = async (commentId) => {
    setLoadingRepliesFor(commentId);
    try {
      const comment = comments.find(c => c.id === commentId);
      const cursor = comment?.repliesCursor;
      
      const response = await getReplies(feedId, commentId, cursor, 10);
      const { items, pageInfo } = response.data;
      
      const mappedReplies = items.map(item => ({
        id: item.commentId,
        content: item.content,
        likeCount: item.likeCount,
        isLiked: item.isLiked,
        isOwner: item.isOwner,
        modifiedAt: item.modifiedAt,
        author: {
          id: item.userProfile.userId,
          profileImage: item.userProfile.userProfileImageUrl,
          nickname: item.userProfile.nickname,
        },
      }));
      
      setComments(prev => prev.map(c => {
        if (c.id === commentId) {
          const newReplies = cursor ? [...c.replies, ...mappedReplies] : mappedReplies;
          const remainingCount = c.replyInfo.replyCount - newReplies.length;
          
          return {
            ...c,
            replies: newReplies,
            repliesLoaded: true,
            repliesCursor: pageInfo.nextCursor,
            hasMoreReplies: pageInfo.hasNextPage && remainingCount > 0,
            // 남은 대댓글 수 업데이트
            remainingRepliesCount: remainingCount > 0 ? remainingCount : 0,
          };
        }
        return c;
      }));
    } catch (err) {
      console.error('Failed to load replies:', err);
      showError('대댓글을 불러오는데 실패했습니다.');
    } finally {
      setLoadingRepliesFor(null);
    }
  };

  // 좋아요 목록 로드
  const loadLikes = async (cursor = null) => {
    setIsLoadingLikes(true);
    try {
      const response = await getFeedLikes(feedId, cursor, 20);
      const { items, pageInfo } = response.data;
      
      const mappedUsers = items.map(item => ({
        id: item.userProfile.userId,
        profileImage: item.userProfile.userProfileImageUrl,
        nickname: item.userProfile.nickname,
        isFollowing: item.isFollowing,
      }));
      
      if (cursor) {
        setLikedUsers(prev => [...prev, ...mappedUsers]);
      } else {
        setLikedUsers(mappedUsers);
      }
      
      setLikesCursor(pageInfo.nextCursor);
      setHasMoreLikes(pageInfo.hasNextPage);
    } catch (err) {
      console.error('Failed to load likes:', err);
    } finally {
      setIsLoadingLikes(false);
    }
  };

  // 좋아요 모달 열기
  const handleOpenLikesModal = () => {
    setShowLikesModal(true);
    setLikedUsers([]);
    setLikesCursor(null);
    loadLikes();
  };

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
    try {
      if (isLiked) {
        const response = await unlikeFeed(feedId);
        setIsLiked(response.data.isLiked);
        setLikeCount(response.data.likeCount);
      } else {
        const response = await likeFeed(feedId);
        setIsLiked(response.data.isLiked);
        setLikeCount(response.data.likeCount);
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
      showError('좋아요 처리에 실패했습니다.');
    }
  };

  // 댓글 좋아요 토글
  const handleCommentLike = async (commentId, isReply = false, parentCommentId = null) => {
    try {
      // 현재 좋아요 상태 찾기
      let currentIsLiked = false;
      
      if (isReply && parentCommentId) {
        const parentComment = comments.find(c => c.id === parentCommentId);
        const reply = parentComment?.replies.find(r => r.id === commentId);
        currentIsLiked = reply?.isLiked || false;
      } else {
        const comment = comments.find(c => c.id === commentId);
        currentIsLiked = comment?.isLiked || false;
      }

      let response;
      if (currentIsLiked) {
        response = await unlikeComment(feedId, commentId);
      } else {
        response = await likeComment(feedId, commentId);
      }

      // 상태 업데이트
      if (isReply && parentCommentId) {
        setComments(prev => prev.map(c => {
          if (c.id === parentCommentId) {
            return {
              ...c,
              replies: c.replies.map(r => {
                if (r.id === commentId) {
                  return {
                    ...r,
                    isLiked: response.data.isLiked,
                    likeCount: response.data.likeCount,
                  };
                }
                return r;
              }),
            };
          }
          return c;
        }));
      } else {
        setComments(prev => prev.map(c => {
          if (c.id === commentId) {
            return {
              ...c,
              isLiked: response.data.isLiked,
              likeCount: response.data.likeCount,
            };
          }
          return c;
        }));
      }
    } catch (err) {
      console.error('Failed to toggle comment like:', err);
      showError('좋아요 처리에 실패했습니다.');
    }
  };

  // 댓글 작성
  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;

    setIsSubmittingComment(true);
    try {
      const response = await createComment(
        feedId, 
        commentText.trim(), 
        replyTo?.commentId || null
      );
      
      const newCommentData = {
        id: response.data.commentId,
        content: response.data.content,
        likeCount: response.data.likeCount,
        isLiked: response.data.isLiked,
        isOwner: response.data.isOwner,
        modifiedAt: response.data.modifiedAt,
        author: {
          id: response.data.userProfile.userId,
          profileImage: response.data.userProfile.userProfileImageUrl,
          nickname: response.data.userProfile.nickname,
        },
      };

      if (replyTo) {
        // 대댓글 추가 - 해당 부모 댓글에만 추가
        setComments(prev => prev.map(comment => {
          if (comment.id === replyTo.commentId) {
            return {
              ...comment,
              replies: [...comment.replies, newCommentData],
              repliesLoaded: true,
              replyInfo: {
                ...comment.replyInfo,
                hasReplies: true,
                replyCount: comment.replyInfo.replyCount + 1,
              },
            };
          }
          return comment;
        }));
      } else {
        // 일반 댓글 추가
        const newComment = {
          ...newCommentData,
          replyInfo: response.data.replyInfo || { hasReplies: false, replyCount: 0 },
          replies: [],
          repliesLoaded: false,
          repliesCursor: null,
          hasMoreReplies: false,
        };
        setComments(prev => [newComment, ...prev]);
      }

      setCommentText('');
      setReplyTo(null);
      success('댓글이 작성되었습니다.');
    } catch (err) {
      console.error('Failed to create comment:', err);
      if (err.message === 'content_too_large') {
        showError('댓글이 너무 깁니다.');
      } else {
        showError('댓글 작성에 실패했습니다.');
      }
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
      await deleteComment(feedId, deleteTarget.id);

      if (deleteTarget.type === 'comment') {
        setComments(prev => prev.filter(c => c.id !== deleteTarget.id));
      } else if (deleteTarget.type === 'reply') {
        setComments(prev => prev.map(comment => {
          if (comment.id === deleteTarget.parentId) {
            return {
              ...comment,
              replies: comment.replies.filter(r => r.id !== deleteTarget.id),
              replyInfo: {
                ...comment.replyInfo,
                replyCount: Math.max(0, comment.replyInfo.replyCount - 1),
                hasReplies: comment.replies.length > 1,
              },
            };
          }
          return comment;
        }));
      }

      success('댓글이 삭제되었습니다.');
    } catch (err) {
      console.error('Failed to delete comment:', err);
      if (err.message === 'comment_delete_denied') {
        showError('댓글을 삭제할 권한이 없습니다.');
      } else {
        showError('댓글 삭제에 실패했습니다.');
      }
    } finally {
      setShowDeleteModal(false);
      setDeleteTarget(null);
    }
  };

  // 피드 삭제
  const handleDeleteFeed = async () => {
    try {
      await deleteFeed(feedId);
      success('피드가 삭제되었습니다.');
      navigate('/feed');
    } catch (err) {
      console.error('Failed to delete feed:', err);
      if (err.message === 'feed_delete_denied') {
        showError('피드를 삭제할 권한이 없습니다.');
      } else {
        showError('피드 삭제에 실패했습니다.');
      }
    }
  };

  // 더 많은 댓글 로드
  const handleLoadMoreComments = async () => {
    if (isLoadingMoreComments || !hasMoreComments) return;
    setIsLoadingMoreComments(true);
    await loadComments(commentsCursor);
    setIsLoadingMoreComments(false);
  };

  // 남은 대댓글 수 계산
  const getRemainingRepliesCount = (comment) => {
    if (!comment.repliesLoaded) {
      return comment.replyInfo.replyCount;
    }
    return comment.replyInfo.replyCount - comment.replies.length;
  };

  const feedActions = feed?.isOwner ? [
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

  return (
    <div className="feed-detail-page">
      <Header 
        showBack 
        title="피드"
        rightAction={feed.isOwner ? () => setShowActionSheet(true) : undefined}
        rightIcon={feed.isOwner ? <IoEllipsisHorizontal size={24} /> : undefined}
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
                {currentImageIndex > 0 && (
                  <button 
                    className="feed-detail-page__image-nav feed-detail-page__image-nav--prev"
                    onClick={handlePrevImage}
                  >
                    <IoChevronBack size={24} />
                  </button>
                )}
                {currentImageIndex < feed.images.length - 1 && (
                  <button 
                    className="feed-detail-page__image-nav feed-detail-page__image-nav--next"
                    onClick={handleNextImage}
                  >
                    <IoChevronForward size={24} />
                  </button>
                )}

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
          onClick={handleOpenLikesModal}
        >
          좋아요 {formatNumber(likeCount)}개
        </div>

        {/* 본문 */}
        {feed.content && (
          <div className="feed-detail-page__body">
            <span className="feed-detail-page__body-author">{feed.author.nickname}</span>
            <span className="feed-detail-page__body-content">{feed.content}</span>
          </div>
        )}

        {/* 사용된 옷 */}
        {feed.clothes && feed.clothes.length > 0 && (
          <div className="feed-detail-page__clothes">
            <h3 className="feed-detail-page__clothes-title">착용 아이템</h3>
            <div className="feed-detail-page__clothes-list">
              {feed.clothes.map((item) => (
                <div key={item.id} className="feed-detail-page__clothes-item">
                  <div className="feed-detail-page__clothes-image">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.productName} />
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
          {formatDate(feed.postedTime)}
        </div>

        {/* 댓글 섹션 */}
        <div className="feed-detail-page__comments">
          {comments.length === 0 ? (
            <div className="feed-detail-page__comments-empty">
              아직 댓글이 없습니다.
            </div>
          ) : (
            <>
              <h3 className="feed-detail-page__comments-title">
                댓글
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
                        <span>{formatDate(comment.modifiedAt)}</span>
                        <button onClick={() => handleCommentLike(comment.id)} style={{display:"flex", alignItems:"center", gap:"5px"}}>
                          {comment.isLiked ? <IoHeart size={12} /> : <IoHeartOutline size={12} />}
                          {comment.likeCount > 0 && ` ${comment.likeCount}`}
                        </button>
                        <button onClick={() => handleReply(comment)}>답글 달기</button>
                        {comment.isOwner && (
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

                  {/* 답글 보기 버튼 (대댓글이 있고 아직 로드 안 했을 때) */}
                  {comment.replyInfo.hasReplies && !comment.repliesLoaded && (
                    <button 
                      className="feed-detail-page__view-replies"
                      onClick={() => loadReplies(comment.id)}
                      disabled={loadingRepliesFor === comment.id}
                    >
                      {loadingRepliesFor === comment.id 
                        ? '로딩 중...' 
                        : `답글 ${comment.replyInfo.replyCount}개 보기`}
                    </button>
                  )}

                  {/* 대댓글 목록 */}
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
                              <span>{formatDate(reply.modifiedAt)}</span>
                              <button onClick={() => handleCommentLike(reply.id, true, comment.id)} style={{display:"flex", alignItems:"center", gap:"5px"}}>
                                {reply.isLiked ? <IoHeart size={12} /> : <IoHeartOutline size={12} />}
                                {reply.likeCount > 0 && ` ${reply.likeCount}`}
                              </button>
                              {reply.isOwner && (
                                <button 
                                  onClick={() => {
                                    setDeleteTarget({ 
                                      type: 'reply', 
                                      id: reply.id,
                                      parentId: comment.id 
                                    });
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

                  {/* 답글 더보기 버튼 (이미 로드했고 더 있을 때) */}
                  {comment.repliesLoaded && getRemainingRepliesCount(comment) > 0 && (
                    <button 
                      className="feed-detail-page__view-replies"
                      onClick={() => loadReplies(comment.id)}
                      disabled={loadingRepliesFor === comment.id}
                    >
                      {loadingRepliesFor === comment.id 
                        ? '로딩 중...' 
                        : `답글 ${getRemainingRepliesCount(comment)}개 더 보기`}
                    </button>
                  )}
                </div>
              ))}

              {/* 댓글 더보기 버튼 */}
              {hasMoreComments && (
                <button 
                  className="feed-detail-page__load-more"
                  onClick={handleLoadMoreComments}
                  disabled={isLoadingMoreComments}
                >
                  {isLoadingMoreComments ? '로딩 중...' : '댓글 더보기'}
                </button>
              )}
            </>
          )}
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
          {isLoadingLikes && likedUsers.length === 0 ? (
            <div className="feed-detail-page__likes-loading">
              <Spinner size="small" />
            </div>
          ) : likedUsers.length === 0 ? (
            <div className="feed-detail-page__likes-empty">
              아직 좋아요가 없습니다.
            </div>
          ) : (
            <>
              {likedUsers.map(likedUser => (
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
              
              {hasMoreLikes && (
                <button 
                  className="feed-detail-page__likes-load-more"
                  onClick={() => loadLikes(likesCursor)}
                  disabled={isLoadingLikes}
                >
                  {isLoadingLikes ? '로딩 중...' : '더보기'}
                </button>
              )}
            </>
          )}
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