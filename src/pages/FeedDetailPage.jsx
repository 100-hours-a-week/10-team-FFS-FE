import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { Button, Spinner, AlertModal, ActionSheet, Modal, ScrollToTopButton, LoginPromptModal } from '../components/common';
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
  updateComment,
  deleteComment,
  likeComment,
  unlikeComment,
  followUser,
  unfollowUser,
  getChatRooms,
} from '../api';
import { useChatContext } from '../contexts/ChatContext';
import { formatDate, formatNumber } from '../utils/helpers';
import {
  IoHeart, IoHeartOutline, IoChatbubbleOutline,
  IoChevronBack, IoChevronForward, IoEllipsisHorizontal,
  IoPaperPlaneOutline,
} from 'react-icons/io5';
import './FeedDetailPage.css';
import defaultProfile from '../assets/defalt.png';

const FeedDetailPage = () => {
  const { feedId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const { sendChatMessage } = useChatContext();
  const commentInputRef = useRef(null);
  const commentsObserverRef = useRef(null);
  const isLoadingCommentsRef = useRef(false);

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
  const [loadingRepliesFor, setLoadingRepliesFor] = useState(null);
  
  // 댓글 수정 관련 상태 (모달 대신 입력창 사용)
  const [editingComment, setEditingComment] = useState(null); // { id, isReply, parentId }
  
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

  // 공유 관련 상태
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showDmModal, setShowDmModal] = useState(false);
  const [dmRooms, setDmRooms] = useState([]);
  const [isDmRoomsLoading, setIsDmRoomsLoading] = useState(false);

  // 500자 넘으면 경고
  const MAX_CONTENT_LENGTH = 500;
  const [warned, setWarned] = useState(false);

  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // 로그인 유도 모달
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalMessage, setLoginModalMessage] = useState('');

  const requireLogin = (message) => {
    setLoginModalMessage(message);
    setShowLoginModal(true);
  };

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
            name: c.name,
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
        replyInfo: item.replyInfo || { hasReplies: false, replyCount: 0 },
        replies: [],
        repliesLoaded: false,
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
      
      mappedUsers.sort((a, b) => {
        const aIsMe = a.id === user?.id;
        const bIsMe = b.id === user?.id;
        if (aIsMe) return 1;
        if (bIsMe) return -1;
        if (a.isFollowing === b.isFollowing) return 0;
        return a.isFollowing ? -1 : 1;
      });
      
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

  const handleOpenLikesModal = () => {
    setShowLikesModal(true);
    setLikedUsers([]);
    setLikesCursor(null);
    loadLikes();
  };

  const handlePrevImage = () => {
    setCurrentImageIndex(prev => prev - 1);
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev => prev + 1);
  };

  const handleLike = async () => {
    if (!user) {
      requireLogin('좋아요를 누르려면 로그인이 필요합니다.');
      return;
    }
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

  const handleToggleFollow = async (targetUserId) => {
    if (!user) {
      requireLogin('팔로우하려면 로그인이 필요합니다.');
      return;
    }
    const targetUser = likedUsers.find(u => u.id === targetUserId);
    if (!targetUser) return;
  
    try {
      if (targetUser.isFollowing) {
        await unfollowUser(targetUserId);
      } else {
        await followUser(targetUserId);
      }
  
      // 좋아요 목록에서 팔로우 상태 업데이트
      setLikedUsers(prev => prev.map(u => {
        if (u.id === targetUserId) {
          return { ...u, isFollowing: !u.isFollowing };
        }
        return u;
      }));
  
      // 피드 작성자의 팔로우 상태도 동기화
      if (feed && feed.author.id === targetUserId) {
        setFeed(prev => ({
          ...prev,
          isFollowing: !targetUser.isFollowing,
        }));
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      if (err.message === 'already_following') {
        showError('이미 팔로우한 유저입니다.');
      } else {
        showError('팔로우 처리에 실패했습니다.');
      }
    }
  };


  const handleToggleAuthorFollow = async () => {
    if (!user) {
      requireLogin('팔로우하려면 로그인이 필요합니다.');
      return;
    }
    if (feed.isFollowLoading) return;
    setIsFollowLoading(true);
    try {
      if (feed.isFollowing) {
        await unfollowUser(feed.author.id);
      } else {
        await followUser(feed.author.id);
      }
      setFeed(prev => ({
        ...prev,
        isFollowing: !prev.isFollowing,
      }));
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      showError('팔로우 처리에 실패했습니다.');
    } finally {
      setIsFollowLoading(false);
    }
  };
  

  const handleCommentLike = async (commentId, isReply = false, parentCommentId = null) => {
    if (!user) {
      requireLogin('좋아요를 누르려면 로그인이 필요합니다.');
      return;
    }
    try {
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

  // 500자 넘으면 경고해주는 함수
  const handleContentChange = (e) => {
    const value = e.target.value;
    setCommentText(value);

    if (value.length === MAX_CONTENT_LENGTH && !warned) {
      showError('내용은 최대 500자까지 입력할 수 있어요.');
      setWarned(true);
    }

    if (value.length < MAX_CONTENT_LENGTH && warned) {
      setWarned(false);
    }
  };

  // 댓글 작성/수정 제출
  const handleSubmitComment = async () => {
    if (!user) {
      requireLogin('댓글을 작성하려면 로그인이 필요합니다.');
      return;
    }
    if (!commentText.trim()) return;

    if (commentText.length > MAX_CONTENT_LENGTH) {
      showError(`댓글은 최대 ${MAX_CONTENT_LENGTH}자까지 입력 가능합니다.`);
      return;
    }

    setIsSubmittingComment(true);
    try {
      if (editingComment) {
        // 수정 모드
        const response = await updateComment(feedId, editingComment.id, commentText.trim());
        
        if (editingComment.isReply && editingComment.parentId) {
          // 대댓글 수정
          setComments(prev => prev.map(c => {
            if (c.id === editingComment.parentId) {
              return {
                ...c,
                replies: c.replies.map(r => {
                  if (r.id === editingComment.id) {
                    return {
                      ...r,
                      content: response.data.content,
                      modifiedAt: response.data.modifiedAt,
                    };
                  }
                  return r;
                }),
              };
            }
            return c;
          }));
        } else {
          // 일반 댓글 수정
          setComments(prev => prev.map(c => {
            if (c.id === editingComment.id) {
              return {
                ...c,
                content: response.data.content,
                modifiedAt: response.data.modifiedAt,
              };
            }
            return c;
          }));
        }

        setEditingComment(null);
        setCommentText('');
        success('댓글이 수정되었습니다.');
      } else {
        // 작성 모드
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
      }
    } catch (err) {
      console.error('Failed to submit comment:', err);
      if (err.message === 'content_too_large') {
        showError('댓글이 너무 깁니다.');
      } else if (err.message === 'comment_edit_denied') {
        showError('댓글을 수정할 권한이 없습니다.');
      } else {
        showError(editingComment ? '댓글 수정에 실패했습니다.' : '댓글 작성에 실패했습니다.');
      }
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // 답글 달기
  const handleReply = (comment) => {
    if (!user) {
      requireLogin('답글을 작성하려면 로그인이 필요합니다.');
      return;
    }
    // 수정 모드 취소
    setEditingComment(null);
    setReplyTo({ commentId: comment.id, nickname: comment.author.nickname });
    setCommentText('');
    commentInputRef.current?.focus();
  };

  // 댓글 수정 시작
  const handleStartEditComment = (comment, isReply = false, parentId = null) => {
    // 답글 모드 취소
    setReplyTo(null);
    setEditingComment({ 
      id: comment.id, 
      isReply, 
      parentId,
      nickname: comment.author.nickname,
    });
    setCommentText(comment.content);
    commentInputRef.current?.focus();
  };

  // 수정/답글 취소
  const handleCancelCommentAction = () => {
    setEditingComment(null);
    setReplyTo(null);
    setCommentText('');
  };

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

  const handleLoadMoreComments = useCallback(async () => {
    if (isLoadingCommentsRef.current || !hasMoreComments) return;
    isLoadingCommentsRef.current = true;
    setIsLoadingMoreComments(true);
    await loadComments(commentsCursor);
    setIsLoadingMoreComments(false);
    isLoadingCommentsRef.current = false;
  }, [hasMoreComments, commentsCursor, loadComments]);

  // 댓글 무한 스크롤 콜백 ref (useInfiniteScroll 패턴과 동일)
  const commentsLastElementRef = useCallback((node) => {
    if (!('IntersectionObserver' in window)) {
      return;
    }
    if (isLoadingCommentsRef.current) {
      return;
    }

    if (commentsObserverRef.current) {
      commentsObserverRef.current.disconnect();
    }

    commentsObserverRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMoreComments) {
          handleLoadMoreComments();
        }
      },
      { rootMargin: '200px' }
    );

    if (node) {
      commentsObserverRef.current.observe(node);
    }
  }, [hasMoreComments, handleLoadMoreComments]);

  const getRemainingRepliesCount = (comment) => {
    if (!comment.repliesLoaded) {
      return comment.replyInfo.replyCount;
    }
    return comment.replyInfo.replyCount - comment.replies.length;
  };

  // 입력창 placeholder 텍스트
  const getInputPlaceholder = () => {
    if (!user) return '로그인 후 댓글을 작성할 수 있습니다.';
    if (editingComment) return '댓글을 수정하세요...';
    if (replyTo) return '답글을 입력하세요...';
    return '댓글을 입력하세요...';
  };

  // 비회원 댓글 입력 포커스 시 로그인 유도
  const handleCommentInputFocus = () => {
    if (!user) {
      commentInputRef.current?.blur();
      requireLogin('댓글을 작성하려면 로그인이 필요합니다.');
    }
  };

  // 입력창 버튼 텍스트
  const getSubmitButtonText = () => {
    if (editingComment) return '수정';
    return '등록';
  };

  // 링크 복사
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      success('링크가 복사되었습니다');
    } catch (_) {
      showError('링크 복사에 실패했습니다.');
    }
    setShowShareSheet(false);
  };

  // DM 공유 모달 열기
  const handleOpenDmShare = async () => {
    if (!user) {
      setShowShareSheet(false);
      requireLogin('DM 공유를 이용하려면 로그인이 필요합니다.');
      return;
    }
    setShowShareSheet(false);
    setShowDmModal(true);
    setIsDmRoomsLoading(true);
    try {
      const response = await getChatRooms(null, 20);
      setDmRooms(response.data.rooms ?? []);
    } catch (err) {
      console.error('채팅방 목록 조회 실패:', err);
      setDmRooms([]);
    } finally {
      setIsDmRoomsLoading(false);
    }
  };

  // 채팅방 선택하여 피드 공유
  const handleShareToRoom = async (room) => {
    try {
      sendChatMessage(room.roomId, {
        type: 'FEED',
        relatedFeedId: Number(feedId),
        clientMessageId: crypto.randomUUID(),
      });
      setShowDmModal(false);
      success('피드를 공유했습니다');
      navigate(`/dm/${room.roomId}`, {
        state: {
          opponent: {
            userId: room.opponent?.userId,
            nickname: room.opponent?.nickname,
            profileImageUrl: room.opponent?.profileImageUrl,
          },
          unreadCount: 0,
        },
      });
    } catch (err) {
      console.error('피드 공유 실패:', err);
      showError('피드 공유에 실패했습니다.');
    }
  };

  const shareActions = [
    { label: '링크 복사', onClick: handleCopyLink },
    { label: 'DM으로 공유', onClick: handleOpenDmShare },
  ];

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
      />

      <div className="feed-detail-page__content">
        {/* 작성자 정보 */}
        <div className="feed-detail-page__author">
          <div 
            className="feed-detail-page__author-info"
            onClick={() => navigate(`/profile/${feed.author.id}`)}
          >
            <div className="feed-detail-page__avatar">
              <img src={feed.author.profileImage || defaultProfile } alt={feed.author.nickname} className="feed-detail-page__avatar-placeholder"/>
            </div>
            <span className="feed-detail-page__nickname">{feed.author.nickname}</span>
          </div>

          {feed.isOwner ? (
            <button
              className="feed-detail-page__more-btn"
              onClick={() => setShowActionSheet(true)}
            >
              <IoEllipsisHorizontal size={24} />
            </button>
          ) : (
            <Button
              size="small"
              variant={feed.isFollowing ? 'secondary' : 'primary'}
              onClick={handleToggleAuthorFollow}
              disabled={isFollowLoading}
            >
              {isFollowLoading ? '' : feed.isFollowing ? '팔로잉' : '팔로우'}
            </Button>
          )}
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
            onClick={() => {
              if (!user) {
                requireLogin('댓글을 작성하려면 로그인이 필요합니다.');
                return;
              }
              commentInputRef.current?.focus();
            }}
          >
            <IoChatbubbleOutline size={24} />
          </button>
          <button
            className="feed-detail-page__action-btn"
            onClick={() => setShowShareSheet(true)}
          >
            <IoPaperPlaneOutline size={24} />
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
                <div key={item.id} className="feed-detail-page__clothes-item" onClick={() => navigate(`/clothes/${item.id}`)}>
                  <div className="feed-detail-page__clothes-image">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} />
                    ) : (
                      <div className="feed-detail-page__clothes-placeholder">사진</div>
                    )}
                  </div>
                  <span className="feed-detail-page__clothes-name">{item.name || '-'}</span>
                  {item.price ? (
                      <span className="feed-detail-page__clothes-price">
                        {item.price.toLocaleString()}원
                      </span>
                    ):(
                      <span className="feed-detail-page__clothes-price">-</span>
                    )}
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
              <h3 className="feed-detail-page__comments-title">댓글</h3>
              {comments.map((comment, index) => (
                <div
                  key={comment.id}
                  ref={index === comments.length - 1 ? commentsLastElementRef : null}
                  className="feed-detail-page__comment"
                >
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
                          <>
                            <button onClick={() => handleStartEditComment(comment)}>
                              수정
                            </button>
                            <button 
                              onClick={() => {
                                setDeleteTarget({ type: 'comment', id: comment.id });
                                setShowDeleteModal(true);
                              }}
                            >
                              삭제
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 답글 보기 버튼 */}
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
                                <>
                                  <button onClick={() => handleStartEditComment(reply, true, comment.id)}>
                                    수정
                                  </button>
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
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 답글 더보기 버튼 */}
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

              {/* 댓글 로딩 인디케이터 */}
              {isLoadingMoreComments && (
                <div className="feed-detail-page__comments-loading">
                  <Spinner size="small" />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 스크롤 투 탑 버튼 */}
      <ScrollToTopButton className="scroll-to-top-button--feed-detail" />

      {/* 댓글 입력 */}
      <div className="feed-detail-page__comment-input">
        {/* 답글 또는 수정 중 표시 */}
        {(replyTo || editingComment) && (
          <div className="feed-detail-page__reply-indicator">
            <span>
              {editingComment 
                ? '댓글 수정 중' 
                : `@${replyTo.nickname}에게 답글 작성 중`
              }
            </span>
            <button onClick={handleCancelCommentAction}>취소</button>
          </div>
        )}
        <div className="feed-detail-page__comment-input-row">
          <input
            ref={commentInputRef}
            type="text"
            placeholder={getInputPlaceholder()}
            value={commentText}
            onChange={handleContentChange}
            onFocus={handleCommentInputFocus}
            onKeyPress={(e) => e.key === 'Enter' && handleSubmitComment()}
            maxLength={MAX_CONTENT_LENGTH}
            readOnly={!user}
          />
          <Button 
            size="small"
            onClick={handleSubmitComment}
            loading={isSubmittingComment}
            disabled={!commentText.trim()}
          >
            {getSubmitButtonText()}
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
                >
                  <div 
                    className="feed-detail-page__likes-user-info"
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
                  {likedUser.id !== user?.id && (
                    <Button
                      size="small"
                      variant={likedUser.isFollowing ? 'secondary' : 'primary'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFollow(likedUser.id);
                      }}
                    >
                      {likedUser.isFollowing ? '팔로잉' : '팔로우'}
                    </Button>
                  )}
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

      {/* 공유 액션 시트 */}
      <ActionSheet
        isOpen={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        actions={shareActions}
      />

      {/* DM 채팅방 선택 모달 */}
      <Modal
        isOpen={showDmModal}
        onClose={() => setShowDmModal(false)}
        title="DM으로 공유"
      >
        <div className="feed-detail-page__dm-list">
          {isDmRoomsLoading ? (
            <div className="feed-detail-page__dm-loading">
              <Spinner size="small" />
            </div>
          ) : dmRooms.length === 0 ? (
            <div className="feed-detail-page__dm-empty">
              채팅 중인 대화가 없습니다
            </div>
          ) : (
            dmRooms.map(room => (
              <div
                key={room.roomId}
                className="feed-detail-page__dm-room"
                onClick={() => handleShareToRoom(room)}
              >
                <div className="feed-detail-page__dm-avatar">
                  {room.opponent?.profileImageUrl ? (
                    <img src={room.opponent.profileImageUrl} alt={room.opponent.nickname} />
                  ) : (
                    <div className="feed-detail-page__dm-avatar-placeholder" />
                  )}
                </div>
                <span className="feed-detail-page__dm-nickname">
                  {room.opponent?.nickname}
                </span>
              </div>
            ))
          )}
        </div>
      </Modal>

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

      {/* 로그인 유도 모달 */}
      <LoginPromptModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        message={loginModalMessage}
      />
    </div>
  );
};

export default FeedDetailPage;