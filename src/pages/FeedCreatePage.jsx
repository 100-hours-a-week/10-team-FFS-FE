import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Header } from '../components/layout';
import { Button, AlertModal, Modal, Spinner } from '../components/common';
import { useToast } from '../contexts/ToastContext';
import { mockClothes } from '../mocks/data';
import { fileToDataUrl, isValidUploadImage } from '../utils/helpers';
import { IoAdd, IoClose, IoCheckmark } from 'react-icons/io5';
import { createFeed, updateFeed, getFeedDetail, getPresignedUrls, uploadToS3 } from '../api';
import './FeedCreatePage.css';

const FeedCreatePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { feedId } = useParams(); // 수정 모드일 때 feedId가 있음
  const { success, error: showError } = useToast();
  const fileInputRef = useRef(null);

  const isEditMode = !!feedId;

  // AI 코디에서 공유된 이미지
  const presetImage = location.state?.presetImage;

  const [images, setImages] = useState([]);
  const [content, setContent] = useState('');
  const [selectedClothes, setSelectedClothes] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showClothesModal, setShowClothesModal] = useState(false);

  // 500자 넘으면 경고
  const MAX_CONTENT_LENGTH = 500;
  const [warned, setWarned] = useState(false);

  // 수정 모드: 기존 피드 데이터 로드
  useEffect(() => {
    if (isEditMode) {
      loadFeedData();
    }
  }, [feedId]);

  const loadFeedData = async () => {
    setIsLoading(true);
    try {
      const response = await getFeedDetail(feedId);
      const data = response.data;

      // 기존 이미지 설정 (수정 불가, 표시용)
      setImages(data.imageUrls.map(url => ({
        preview: url,
        isExisting: true, // 기존 이미지 표시
      })));

      // 기존 내용 설정
      setContent(data.content || '');

      // 기존 옷 정보 설정
      if (data.clothes && data.clothes.length > 0) {
        setSelectedClothes(data.clothes.map(c => ({
          id: c.id,
          imageUrl: c.imageUrl,
          productName: c.name,
          price: c.price,
          images: [c.imageUrl], // mockClothes 형식과 맞추기
        })));
      }
    } catch (err) {
      console.error('Failed to load feed:', err);
      showError('피드를 불러오는데 실패했습니다.');
      navigate(-1);
    } finally {
      setIsLoading(false);
    }
  };

  // AI 코디에서 온 이미지 처리 (생성 모드에서만)
  useEffect(() => {
    if (!isEditMode && presetImage) {
      const loadPresetImage = async () => {
        try {
          const response = await fetch(presetImage);
          const blob = await response.blob();
          const file = new File([blob], 'ai-coordination.png', { type: blob.type || 'image/png' });
          
          setImages([{ 
            file,
            preview: presetImage, 
            isPreset: true 
          }]);
        } catch (err) {
          console.error('Failed to load preset image:', err);
          showError('AI 코디 이미지를 불러오는데 실패했습니다.');
        }
      };
      
      loadPresetImage();
    }
  }, [presetImage, isEditMode, showError]);

  // 이미지 선택 (생성 모드에서만)
  const handleImageSelect = async (e) => {
    if (isEditMode) return; // 수정 모드에서는 이미지 변경 불가

    const files = Array.from(e.target.files || []);
    
    if (images.length + files.length > 5) {
      showError('최대 5장까지 업로드 가능합니다.');
      return;
    }

    const validFiles = files.filter(file => {
      if (!isValidUploadImage(file)) {
        showError('PNG, JPEG 파일만 업로드 가능합니다.');
        return false;
      }
      return true;
    });

    try {
      const newImages = await Promise.all(
        validFiles.map(async (file) => ({
          file,
          preview: await fileToDataUrl(file),
        }))
      );
      
      setImages(prev => [...prev, ...newImages]);
    } catch (err) {
      showError('이미지를 불러오는데 실패했습니다.');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 이미지 삭제 (생성 모드에서만)
  const handleImageRemove = (index) => {
    if (isEditMode) return; // 수정 모드에서는 이미지 변경 불가
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // 옷 선택 토글
  const handleClothesToggle = (clothes) => {
    setSelectedClothes(prev => {
      const isSelected = prev.some(c => c.id === clothes.id);
      if (isSelected) {
        return prev.filter(c => c.id !== clothes.id);
      } else {
        if (prev.length >= 10) {
          showError('최대 10개까지 선택 가능합니다.');
          return prev;
        }
        return [...prev, clothes];
      }
    });
  };

  // 폼 제출
  const handleSubmit = async () => {
    if (!isEditMode && images.length === 0) {
      showError('이미지를 1장 이상 업로드해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode) {
        // 수정 모드
        const feedData = {};

        // content는 항상 전송 (빈 문자열도 가능)
        feedData.content = content.trim();

        // clothesIds도 항상 전송 (빈 배열도 가능)
        feedData.clothesIds = selectedClothes.map(c => c.id);

        await updateFeed(feedId, feedData);
        success('수정이 완료되었습니다.');
        navigate(`/feed/${feedId}`);
      } else {
        // 생성 모드
        // 1. Presigned URL 발급
        const files = images.map(img => ({
          name: img.file.name,
          type: img.file.type,
        }));
        
        const presignedResponse = await getPresignedUrls('FEED', files);
        const urls = presignedResponse.data;

        // 2. S3에 이미지 업로드
        const uploadPromises = urls.map((urlInfo, index) => 
          uploadToS3(urlInfo.presignedUrl, images[index].file)
        );
        await Promise.all(uploadPromises);

        // 3. 피드 생성 API 호출
        const fileIds = urls.map(urlInfo => urlInfo.fileId);
        
        const feedData = {
          fileIds,
        };

        if (selectedClothes.length > 0) {
          feedData.clothesIds = selectedClothes.map(c => c.id);
        }

        if (content.trim()) {
          feedData.content = content.trim();
        }

        await createFeed(feedData);
        success('피드가 작성되었습니다.');
        navigate('/feed');
      }
    } catch (err) {
      console.error('Feed submission failed:', err);
      
      const errorMessage = err.message || 'internal_server_error';
      
      switch (errorMessage) {
        case 'maximum_5_files_allowed':
          showError('최대 5장까지 업로드 가능합니다.');
          break;
        case 'minimum_1_file_allowed':
          showError('최소 1장의 이미지가 필요합니다.');
          break;
        case 'file_not_found':
          showError('파일을 찾을 수 없습니다. 다시 시도해주세요.');
          break;
        case 'file_access_denied':
          showError('파일 접근 권한이 없습니다.');
          break;
        case 'not_pending_state':
        case 'uploaded_file_mismatch':
          showError('파일 업로드 상태가 올바르지 않습니다. 다시 시도해주세요.');
          break;
        case 'clothes_not_found':
          showError('선택한 옷을 찾을 수 없습니다.');
          break;
        case 'clothes_access_denied':
          showError('선택한 옷에 접근할 수 없습니다.');
          break;
        case 'content_too_long':
          showError('내용이 너무 깁니다.');
          break;
        case 'maximum_10_clothes_mapping_allowed':
          showError('옷은 최대 10개까지 태그할 수 있습니다.');
          break;
        case 'feed_not_found':
          showError('피드를 찾을 수 없습니다.');
          break;
        case 'feed_edit_denied':
          showError('피드를 수정할 권한이 없습니다.');
          break;
        case 'too_many_files':
          showError('파일 개수가 너무 많습니다.');
          break;
        case 'unsupported_file_type':
          showError('지원하지 않는 파일 형식입니다. PNG, JPEG만 가능합니다.');
          break;
        case 'rate_limit_exceeded':
          showError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
          break;
        default:
          showError(isEditMode ? '피드 수정에 실패했습니다.' : '피드 작성에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 취소 확인
  const handleCancel = () => {
    if (images.length > 0 || content) {
      setShowCancelModal(true);
    } else {
      navigate(-1);
    }
  };

  if (isLoading) {
    return (
      <div className="feed-create-page">
        <Header showBack title={isEditMode ? '피드 수정' : '새 피드'} />
        <div className="feed-create-page__loading">
          <Spinner size="large" />
        </div>
      </div>
    );
  }

  // 500자 넘으면 경고해주는 함수
  const handleContentChange = (e) => {
    const value = e.target.value;
    setContent(value);

    if (value.length === MAX_CONTENT_LENGTH && !warned) {
      showError('내용은 최대 500자까지 입력할 수 있어요.');
      setWarned(true);
    }

    if (value.length < MAX_CONTENT_LENGTH && warned) {
      setWarned(false);
    }
  };


  return (
    <div className="feed-create-page">
      <Header 
        showBack 
        onBack={handleCancel}
        title={isEditMode ? '피드 수정' : '새 피드'}
        rightElement={
          <Button 
            size="small" 
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={!isEditMode && images.length === 0}
          >
            {isEditMode ? '완료' : '공유'}
          </Button>
        }
      />

      <div className="feed-create-page__content">
        {/* 이미지 업로드 */}
        <div className="feed-create-page__section">
          <label className="feed-create-page__label">
            사진 ({images.length}/5)
          </label>
          <div className="feed-create-page__images">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg"
              multiple
              onChange={handleImageSelect}
              style={{ display: 'none' }}
              disabled={isEditMode}
            />
            
            {/* 생성 모드에서만 추가 버튼 표시 */}
            {!isEditMode && images.length < 5 && (
              <button 
                className="feed-create-page__image-add"
                onClick={() => fileInputRef.current?.click()}
              >
                <IoAdd size={32} />
              </button>
            )}

            {images.map((image, index) => (
              <div key={index} className="feed-create-page__image-item">
                <img src={image.preview} alt={`피드 이미지 ${index + 1}`} />
                {/* 생성 모드에서만 삭제 버튼 표시 */}
                {!isEditMode && (
                  <button 
                    className="feed-create-page__image-remove"
                    onClick={() => handleImageRemove(index)}
                  >
                    <IoClose size={16} />
                  </button>
                )}
                {index === 0 && (
                  <span className="feed-create-page__image-main">대표</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 내용 입력 */}
        <div className="feed-create-page__section">
          <label className="feed-create-page__label">내용</label>
          <textarea
            className="feed-create-page__textarea"
            placeholder="내용을 입력하세요..."
            value={content}
            onChange={handleContentChange}
            rows={5}
            maxLength={MAX_CONTENT_LENGTH}
          />
        </div>

        {/* 옷 태그 */}
        <div className="feed-create-page__section">
          <div className="feed-create-page__clothes-header">
            <label className="feed-create-page__label">
              착용 아이템 ({selectedClothes.length}/10)
            </label>
            <button 
              className="feed-create-page__clothes-add-btn"
              onClick={() => setShowClothesModal(true)}
            >
              <IoAdd size={20} />
              추가
            </button>
          </div>
          
          {selectedClothes.length > 0 && (
            <div className="feed-create-page__clothes-list">
              {selectedClothes.map((item) => (
                <div key={item.id} className="feed-create-page__clothes-item">
                  <div className="feed-create-page__clothes-image">
                    {(item.images?.[0] || item.imageUrl) ? (
                      <img src={item.images?.[0] || item.imageUrl} alt={item.productName} />
                    ) : (
                      <div className="feed-create-page__clothes-placeholder">사진</div>
                    )}
                  </div>
                  <span className="feed-create-page__clothes-name">{item.productName}</span>
                  <button 
                    className="feed-create-page__clothes-remove"
                    onClick={() => handleClothesToggle(item)}
                  >
                    <IoClose size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 옷 선택 모달 */}
      <Modal
        isOpen={showClothesModal}
        onClose={() => setShowClothesModal(false)}
        title="옷 선택"
      >
        <div className="feed-create-page__clothes-modal">
          <div className="feed-create-page__clothes-grid">
            {mockClothes.map((item) => {
              const isSelected = selectedClothes.some(c => c.id === item.id);
              return (
                <div 
                  key={item.id}
                  className={`feed-create-page__clothes-grid-item ${isSelected ? 'feed-create-page__clothes-grid-item--selected' : ''}`}
                  onClick={() => handleClothesToggle(item)}
                >
                  <div className="feed-create-page__clothes-grid-image">
                    {item.images?.[0] ? (
                      <img src={item.images[0]} alt={item.productName} />
                    ) : (
                      <div className="feed-create-page__clothes-placeholder">사진</div>
                    )}
                    {isSelected && (
                      <div className="feed-create-page__clothes-grid-check">
                        <IoCheckmark size={20} />
                      </div>
                    )}
                  </div>
                  <span className="feed-create-page__clothes-grid-name">
                    {item.productName}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="feed-create-page__clothes-modal-footer">
            <Button fullWidth onClick={() => setShowClothesModal(false)}>
              선택 완료 ({selectedClothes.length})
            </Button>
          </div>
        </div>
      </Modal>

      {/* 취소 확인 모달 */}
      <AlertModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title={isEditMode ? '수정 취소' : '작성 취소'}
        message={isEditMode 
          ? '수정 중인 내용이 저장되지 않습니다. 취소하시겠습니까?'
          : '작성 중인 내용이 저장되지 않습니다. 취소하시겠습니까?'
        }
        confirmText="취소하기"
        cancelText="계속 작성"
        onConfirm={() => navigate(-1)}
        danger
      />
    </div>
  );
};

export default FeedCreatePage;