import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { Button, Input, Spinner, AlertModal } from '../components/common';
import { useToast } from '../contexts/ToastContext';
import { getPresignedUrls, uploadToS3, requestClothesAnalysis, getClothesAnalysisResult, createClothes } from '../api';
import { fileToDataUrl, isValidUploadImage } from '../utils/helpers';
import { IoAdd, IoClose, IoChevronBack, IoChevronForward } from 'react-icons/io5';
import './ClothesUploadPage.css';

const CATEGORIES = [
  { id: 'TOP', label: '상의' },
  { id: 'BOTTOM', label: '하의' },
  { id: 'DRESS', label: '원피스' },
  { id: 'SHOES', label: '신발' },
  { id: 'ACCESSORY', label: '악세사리' },
  { id: 'ETC', label: '기타' },
];

const POLLING_INTERVAL = 3000;

// source.results를 평탄화해서 캐러셀용 아이템 목록 생성
const flattenResults = (sources, originalPreviews) => {
  const items = [];

  sources.forEach((source, sourceIndex) => {
    const originalPreview = originalPreviews[sourceIndex] || null;
    const sourceLabel = `사진 ${sourceIndex + 1}`;

    if (source.status === 'ABUSING_COMPLETED' && !source.passed) {
      items.push({
        type: 'source',
        sourceId: source.sourceId,
        sourceIndex,
        sourceLabel,
        originalPreview,
        status: 'ABUSE_FAILED',
        detectedCount: 0,
      });
      return;
    }

    if (source.status === 'ACCEPTED' ||
        (source.status === 'ABUSING_COMPLETED' && source.passed)) {
      items.push({
        type: 'source',
        sourceId: source.sourceId,
        sourceIndex,
        sourceLabel,
        originalPreview,
        status: 'PROCESSING',
        detectedCount: 0,
      });
      return;
    }

    if (source.tasks && source.tasks.length > 0) {
      source.tasks.forEach((task, taskIndex) => {
        items.push({
          type: 'task',
          sourceId: source.sourceId,
          sourceIndex,
          sourceLabel,
          originalPreview,
          detectedCount: source.detectedCount || source.tasks.length,
          taskIndexInSource: taskIndex,
          taskId: task.taskId,
          status: task.status,
          fileId: task.fileId,
          imageUrl: task.imageUrl,
          major: task.major || null,
        });
      });
    } else {
      items.push({
        type: 'source',
        sourceId: source.sourceId,
        sourceIndex,
        sourceLabel,
        originalPreview,
        status: 'PROCESSING',
        detectedCount: source.detectedCount || 0,
      });
    }
  });

  return items;
};

// 인디케이터 그룹핑용
const groupBySource = (items) => {
  const groups = [];
  let currentSourceId = null;

  items.forEach((item, index) => {
    if (item.sourceId !== currentSourceId) {
      currentSourceId = item.sourceId;
      groups.push({
        sourceId: item.sourceId,
        sourceLabel: item.sourceLabel,
        indices: [index],
      });
    } else {
      groups[groups.length - 1].indices.push(index);
    }
  });

  return groups;
};

const ClothesUploadPage = () => {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const fileInputRef = useRef(null);
  const pollingRef = useRef(null);

  const [step, setStep] = useState('upload');
  const [images, setImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const [batchId, setBatchId] = useState(null);
  const [batchStatus, setBatchStatus] = useState(null);
  const [originalPreviews, setOriginalPreviews] = useState([]);
  const [carouselItems, setCarouselItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savedItems, setSavedItems] = useState(new Set());

  const [formDataMap, setFormDataMap] = useState({});
  const [newMaterial, setNewMaterial] = useState('');
  const [newColor, setNewColor] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);

  // 이미지 선택
  const handleImageSelect = async (e) => {
    const files = Array.from(e.target.files || []);

    if (images.length + files.length > 10) {
      showError('최대 10장까지 업로드 가능합니다.');
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

  const handleImageRemove = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // 분석하기
  const handleAnalyze = async () => {
    if (images.length === 0) {
      showError('이미지를 1장 이상 업로드해주세요.');
      return;
    }

    setIsUploading(true);
    try {
      const files = images.map(img => ({
        name: img.file.name,
        type: img.file.type,
      }));

      const presignedResponse = await getPresignedUrls('CLOTHES_TEMP', files);
      const urls = presignedResponse.data;

      await Promise.all(
        urls.map((urlInfo, index) => uploadToS3(urlInfo.presignedUrl, images[index].file))
      );

      const fileIds = urls.map(urlInfo => urlInfo.fileId);
      const analysisResponse = await requestClothesAnalysis(fileIds);

      if (analysisResponse.code === 202) {
        // 원본 preview를 저장 (업로드 순서 = source 순서)
        setOriginalPreviews(images.map(img => img.preview));
        setBatchId(analysisResponse.data.batchId);
        setStep('analysis');
        success(`${analysisResponse.data.passed}개 이미지 분석을 시작합니다.`);
      }
    } catch (err) {
      console.error('Analysis request failed:', err);
      showError(err.message || '분석 요청에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  // Polling
  const fetchAnalysisResult = useCallback(async () => {
    if (!batchId) return;

    try {
      const response = await getClothesAnalysisResult(batchId);

      if (response.code === 200) {
        const { status, results } = response.data;
        setBatchStatus(status);

        const items = flattenResults(results, originalPreviews);
        setCarouselItems(items);

        setFormDataMap(prev => {
          const newMap = { ...prev };
          items.forEach(item => {
            if (item.type !== 'task') return;
            const { taskId } = item;

            if (!newMap[taskId]) {
              newMap[taskId] = {
                name: '',
                brand: '',
                price: '',
                size: '',
                purchaseYear: '',
                purchaseMonth: '',
                category: item.major?.category || '',
                materials: item.major?.material || [],
                colors: item.major?.color || [],
                styleTags: item.major?.styleTags || [],
                fileId: item.fileId,
                imageUrl: item.imageUrl,
              };
            } else if (item.status === 'ANALYZING_COMPLETED' && !newMap[taskId].aiUpdated) {
              newMap[taskId] = {
                ...newMap[taskId],
                category: newMap[taskId].category || item.major?.category || '',
                materials: newMap[taskId].materials.length > 0
                  ? newMap[taskId].materials
                  : (item.major?.material || []),
                colors: newMap[taskId].colors.length > 0
                  ? newMap[taskId].colors
                  : (item.major?.color || []),
                styleTags: item.major?.styleTags || [],
                fileId: item.fileId,
                imageUrl: item.imageUrl,
                aiUpdated: true,
              };
            } else {
              newMap[taskId] = {
                ...newMap[taskId],
                fileId: item.fileId || newMap[taskId].fileId,
                imageUrl: item.imageUrl || newMap[taskId].imageUrl,
              };
            }
          });
          return newMap;
        });

        if (status === 'COMPLETED') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }
    } catch (err) {
      console.error('Polling failed:', err);
    }
  }, [batchId, originalPreviews]);

  useEffect(() => {
    if (step === 'analysis' && batchId) {
      fetchAnalysisResult();
      pollingRef.current = setInterval(fetchAnalysisResult, POLLING_INTERVAL);
      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    }
  }, [step, batchId, fetchAnalysisResult]);

  // 폼 헬퍼
  const updateFormData = (taskId, field, value) => {
    setFormDataMap(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], [field]: value },
    }));
  };

  const handleAddMaterial = (taskId) => {
    if (!newMaterial.trim()) return;
    const current = formDataMap[taskId]?.materials || [];
    if (current.includes(newMaterial.trim())) {
      showError('이미 추가된 소재입니다.');
      return;
    }
    updateFormData(taskId, 'materials', [...current, newMaterial.trim()]);
    setNewMaterial('');
  };

  const handleRemoveMaterial = (taskId, index) => {
    const current = formDataMap[taskId]?.materials || [];
    updateFormData(taskId, 'materials', current.filter((_, i) => i !== index));
  };

  const handleAddColor = (taskId) => {
    if (!newColor.trim()) return;
    const current = formDataMap[taskId]?.colors || [];
    if (current.includes(newColor.trim())) {
      showError('이미 추가된 색상입니다.');
      return;
    }
    updateFormData(taskId, 'colors', [...current, newColor.trim()]);
    setNewColor('');
  };

  const handleRemoveColor = (taskId, index) => {
    const current = formDataMap[taskId]?.colors || [];
    updateFormData(taskId, 'colors', current.filter((_, i) => i !== index));
  };

  // 저장
  const handleSaveItem = async (taskId) => {
    const formData = formDataMap[taskId];
    if (!formData) {
      showError('폼 데이터를 찾을 수 없습니다.');
      return;
    }
    if (!formData.category) {
      showError('카테고리를 선택해주세요.');
      return;
    }

    try {
      let boughtDate = null;
      if (formData.purchaseYear && formData.purchaseMonth) {
        boughtDate = `${formData.purchaseYear}-${String(formData.purchaseMonth).padStart(2, '0')}-01`;
      }

      const requestBody = {
        taskId,
        fileId: formData.fileId,
        name: formData.name,
        category: formData.category,
        styleTag: formData.styleTags,
      };
      if (formData.brand) requestBody.brand = formData.brand;
      if (formData.price) requestBody.price = Number(formData.price);
      if (formData.size) requestBody.size = formData.size;
      if (boughtDate) requestBody.boughtDate = boughtDate;
      if (formData.materials.length > 0) requestBody.material = formData.materials;
      if (formData.colors.length > 0) requestBody.color = formData.colors;

      await createClothes(requestBody);
      setSavedItems(prev => new Set([...prev, taskId]));
      success('옷이 저장되었습니다.');

      const completedTasks = carouselItems.filter(
        item => item.type === 'task' && item.status === 'ANALYZING_COMPLETED'
      );
      const allSaved = completedTasks.every(
        item => savedItems.has(item.taskId) || item.taskId === taskId
      );
      if (allSaved && completedTasks.length > 0) {
        setTimeout(() => navigate(-1), 500);
      }
    } catch (err) {
      console.error('Save failed:', err);
      showError(err.message || '저장에 실패했습니다.');
    }
  };

  // 네비게이션
  const goToPrevious = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
    setNewMaterial('');
    setNewColor('');
  };

  const goToNext = () => {
    setCurrentIndex(prev => Math.min(carouselItems.length - 1, prev + 1));
    setNewMaterial('');
    setNewColor('');
  };

  const handleCancel = () => {
    if (images.length > 0 || step === 'analysis') {
      setShowCancelModal(true);
    } else {
      navigate(-1);
    }
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= currentYear - 20; year--) {
      years.push(year);
    }
    return years;
  };

  const generateMonthOptions = () => {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  };

  // 현재 아이템
  const currentItem = carouselItems[currentIndex];
  const currentFormData = currentItem?.type === 'task' ? formDataMap[currentItem.taskId] : null;
  const isCurrentSaved = currentItem?.type === 'task' ? savedItems.has(currentItem.taskId) : false;

  // 인디케이터 그룹
  const indicatorGroups = groupBySource(carouselItems);

  return (
    <div className="clothes-upload-page">
      <Header showBack onBack={handleCancel} title="옷 등록" />

      {/* 업로드 단계 */}
      {step === 'upload' && (
        <div className="clothes-upload-page__content">
          <div className="clothes-upload-page__section">
            <label className="clothes-upload-page__label">
              사진 ({images.length}/10)
            </label>
            <p className="clothes-upload-page__hint">
              분석할 옷 사진을 1~10장 업로드해주세요.
            </p>
            <div className="clothes-upload-page__images">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg"
                multiple
                onChange={handleImageSelect}
                style={{ display: 'none' }}
              />
              {images.length < 10 && (
                <button
                  className="clothes-upload-page__image-add"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <IoAdd size={32} />
                </button>
              )}
              {images.map((image, index) => (
                <div key={index} className="clothes-upload-page__image-item">
                  <img src={image.preview} alt={`옷 ${index + 1}`} />
                  <button
                    className="clothes-upload-page__image-remove"
                    onClick={() => handleImageRemove(index)}
                  >
                    <IoClose size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="clothes-upload-page__action">
            <Button fullWidth onClick={handleAnalyze} loading={isUploading} disabled={images.length === 0}>
              분석하기
            </Button>
          </div>
        </div>
      )}

      {/* 분석 결과 단계 */}
      {step === 'analysis' && (
        <div className="clothes-upload-page__content">
          {carouselItems.length === 0 ? (
            <div className="clothes-upload-page__loading">
              <Spinner />
              <span>분석 준비 중...</span>
            </div>
          ) : (
            <>
              {/* 소스 그룹 헤더 */}
              {currentItem && (
                <div className="clothes-upload-page__source-header">
                  <div className="clothes-upload-page__source-info">
                    {currentItem.originalPreview && (
                      <img
                        src={currentItem.originalPreview}
                        alt={currentItem.sourceLabel}
                        className="clothes-upload-page__source-thumbnail"
                      />
                    )}
                    <div className="clothes-upload-page__source-text">
                      <span className="clothes-upload-page__source-label">
                        {currentItem.sourceLabel}
                      </span>
                      {currentItem.status === 'ABUSE_FAILED' && (
                        <span className="clothes-upload-page__source-badge clothes-upload-page__source-badge--failed">
                          등록 불가
                        </span>
                      )}
                      {currentItem.status === 'PROCESSING' && (
                        <span className="clothes-upload-page__source-badge clothes-upload-page__source-badge--processing">
                          처리 중
                        </span>
                      )}
                      {currentItem.type === 'task' && currentItem.detectedCount > 1 && (
                        <span className="clothes-upload-page__source-badge">
                          {currentItem.detectedCount}개 감지 · {currentItem.taskIndexInSource + 1}번째
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 캐러셀 */}
              <div className="clothes-upload-page__carousel">
                <button
                  className="clothes-upload-page__nav-btn"
                  onClick={goToPrevious}
                  disabled={currentIndex === 0}
                >
                  <IoChevronBack size={24} />
                </button>

                <div className="clothes-upload-page__slide">
                  <div className="clothes-upload-page__image-container">
                    {/* 처리 중 */}
                    {currentItem?.status === 'PROCESSING' && (
                      <div className="clothes-upload-page__image-loading">
                        {currentItem.originalPreview && (
                          <img
                            src={currentItem.originalPreview}
                            alt="원본"
                            className="clothes-upload-page__main-image clothes-upload-page__main-image--dimmed"
                          />
                        )}
                        <div className="clothes-upload-page__image-loading-overlay">
                          <Spinner />
                          <span>이미지 처리 중...</span>
                        </div>
                      </div>
                    )}

                    {/* abuse 실패 */}
                    {currentItem?.status === 'ABUSE_FAILED' && (
                      <div className="clothes-upload-page__image-failed">
                        {currentItem.originalPreview && (
                          <img
                            src={currentItem.originalPreview}
                            alt="원본"
                            className="clothes-upload-page__main-image clothes-upload-page__main-image--dimmed"
                          />
                        )}
                        <div className="clothes-upload-page__image-failed-overlay">
                          <span>등록 불가</span>
                          <p>부적절한 이미지로 판단되었습니다.</p>
                        </div>
                      </div>
                    )}

                    {/* task: 분석 중 */}
                    {currentItem?.type === 'task' && currentItem?.status === 'ANALYZING' && (
                      <>
                        <img
                          src={currentItem.imageUrl}
                          alt="옷"
                          className="clothes-upload-page__main-image"
                        />
                        <div className="clothes-upload-page__analyzing-overlay">
                          <Spinner size="small" />
                          <span>AI 분석 중...</span>
                        </div>
                      </>
                    )}

                    {/* task: 분석 완료 */}
                    {currentItem?.type === 'task' && currentItem?.status === 'ANALYZING_COMPLETED' && (
                      <img
                        src={currentItem.imageUrl}
                        alt="옷"
                        className="clothes-upload-page__main-image"
                      />
                    )}
                  </div>

                  {/* 그룹별 인디케이터 */}
                  <div className="clothes-upload-page__indicators">
                    {indicatorGroups.map((group, groupIndex) => (
                      <div key={group.sourceId} className="clothes-upload-page__indicator-group">
                        {groupIndex > 0 && (
                          <span className="clothes-upload-page__indicator-divider" />
                        )}
                        {group.indices.map(itemIndex => {
                          const item = carouselItems[itemIndex];
                          return (
                            <span
                              key={itemIndex}
                              className={`clothes-upload-page__indicator ${
                                itemIndex === currentIndex ? 'clothes-upload-page__indicator--active' : ''
                              } ${
                                item.type === 'task' && savedItems.has(item.taskId)
                                  ? 'clothes-upload-page__indicator--saved'
                                  : ''
                              } ${
                                item.status === 'ABUSE_FAILED'
                                  ? 'clothes-upload-page__indicator--failed'
                                  : ''
                              }`}
                              onClick={() => setCurrentIndex(itemIndex)}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  className="clothes-upload-page__nav-btn"
                  onClick={goToNext}
                  disabled={currentIndex === carouselItems.length - 1}
                >
                  <IoChevronForward size={24} />
                </button>
              </div>

              {/* 폼 - ANALYZING_COMPLETED task만 */}
              {currentItem?.type === 'task' &&
                currentItem?.status === 'ANALYZING_COMPLETED' &&
                currentFormData &&
                !isCurrentSaved && (
                <div className="clothes-upload-page__form">
                  <div className="clothes-upload-page__section">
                    <Input
                      label="제품명"
                      placeholder="제품명을 입력하세요"
                      value={currentFormData.name}
                      onChange={(e) => updateFormData(currentItem.taskId, 'name', e.target.value)}
                    />
                  </div>
                  <div className="clothes-upload-page__section">
                    <Input
                      label="브랜드"
                      placeholder="브랜드를 입력하세요"
                      value={currentFormData.brand}
                      onChange={(e) => updateFormData(currentItem.taskId, 'brand', e.target.value)}
                    />
                  </div>
                  <div className="clothes-upload-page__section">
                    <Input
                      label="가격"
                      type="number"
                      placeholder="가격을 입력하세요"
                      value={currentFormData.price}
                      onChange={(e) => updateFormData(currentItem.taskId, 'price', e.target.value)}
                    />
                  </div>
                  <div className="clothes-upload-page__section">
                    <Input
                      label="사이즈"
                      placeholder="사이즈를 입력하세요"
                      value={currentFormData.size}
                      onChange={(e) => updateFormData(currentItem.taskId, 'size', e.target.value)}
                    />
                  </div>
                  <div className="clothes-upload-page__section">
                    <label className="clothes-upload-page__label">구매년월</label>
                    <div className="clothes-upload-page__row">
                      <select
                        className="clothes-upload-page__select"
                        value={currentFormData.purchaseYear}
                        onChange={(e) => updateFormData(currentItem.taskId, 'purchaseYear', e.target.value)}
                      >
                        <option value="">년도</option>
                        {generateYearOptions().map(year => (
                          <option key={year} value={year}>{year}년</option>
                        ))}
                      </select>
                      <select
                        className="clothes-upload-page__select"
                        value={currentFormData.purchaseMonth}
                        onChange={(e) => updateFormData(currentItem.taskId, 'purchaseMonth', e.target.value)}
                      >
                        <option value="">월</option>
                        {generateMonthOptions().map(month => (
                          <option key={month} value={month}>{month}월</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="clothes-upload-page__section">
                    <label className="clothes-upload-page__label">카테고리</label>
                    <div className="clothes-upload-page__categories">
                      {CATEGORIES.map(category => (
                        <button
                          key={category.id}
                          className={`clothes-upload-page__category-btn ${
                            currentFormData.category === category.id
                              ? 'clothes-upload-page__category-btn--active'
                              : ''
                          }`}
                          onClick={() => updateFormData(currentItem.taskId, 'category', category.id)}
                        >
                          {category.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="clothes-upload-page__section">
                    <label className="clothes-upload-page__label">소재</label>
                    <div className="clothes-upload-page__tags">
                      {currentFormData.materials.map((material, index) => (
                        <span key={index} className="clothes-upload-page__tag">
                          {material}
                          <button
                            className="clothes-upload-page__tag-remove"
                            onClick={() => handleRemoveMaterial(currentItem.taskId, index)}
                          >
                            <IoClose size={14} />
                          </button>
                        </span>
                      ))}
                      <div className="clothes-upload-page__tag-input-wrapper">
                        <input
                          type="text"
                          className="clothes-upload-page__tag-input"
                          placeholder="소재 입력"
                          value={newMaterial}
                          onChange={(e) => setNewMaterial(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddMaterial(currentItem.taskId)}
                        />
                        <button
                          className="clothes-upload-page__tag-add"
                          onClick={() => handleAddMaterial(currentItem.taskId)}
                        >
                          <IoAdd size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="clothes-upload-page__section">
                    <label className="clothes-upload-page__label">색</label>
                    <div className="clothes-upload-page__tags">
                      {currentFormData.colors.map((color, index) => (
                        <span key={index} className="clothes-upload-page__tag">
                          {color}
                          <button
                            className="clothes-upload-page__tag-remove"
                            onClick={() => handleRemoveColor(currentItem.taskId, index)}
                          >
                            <IoClose size={14} />
                          </button>
                        </span>
                      ))}
                      <div className="clothes-upload-page__tag-input-wrapper">
                        <input
                          type="text"
                          className="clothes-upload-page__tag-input"
                          placeholder="색상 입력"
                          value={newColor}
                          onChange={(e) => setNewColor(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddColor(currentItem.taskId)}
                        />
                        <button
                          className="clothes-upload-page__tag-add"
                          onClick={() => handleAddColor(currentItem.taskId)}
                        >
                          <IoAdd size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="clothes-upload-page__section">
                    <label className="clothes-upload-page__label">
                      스타일태그
                      <span className="clothes-upload-page__label-hint">(AI 분석 결과)</span>
                    </label>
                    <div className="clothes-upload-page__tags">
                      {currentFormData.styleTags.length > 0 ? (
                        currentFormData.styleTags.map((tag, index) => (
                          <span key={index} className="clothes-upload-page__tag clothes-upload-page__tag--readonly">
                            #{tag}
                          </span>
                        ))
                      ) : (
                        <span className="clothes-upload-page__empty-tags">스타일 태그 없음</span>
                      )}
                    </div>
                  </div>
                  <div className="clothes-upload-page__action">
                    <Button fullWidth onClick={() => handleSaveItem(currentItem.taskId)}>
                      옷 정보 추가 완료
                    </Button>
                  </div>
                </div>
              )}

              {/* 저장 완료 */}
              {isCurrentSaved && (
                <div className="clothes-upload-page__saved-message">
                  <span>✓ 저장 완료</span>
                  <p>이 옷은 이미 저장되었습니다.</p>
                </div>
              )}

              {/* 분석 중 메시지 (task) */}
              {currentItem?.type === 'task' && currentItem?.status === 'ANALYZING' && (
                <div className="clothes-upload-page__analyzing-message">
                  <p>AI가 옷을 분석하고 있습니다. 잠시만 기다려주세요.</p>
                </div>
              )}

              {/* 처리 중 메시지 (source) */}
              {currentItem?.status === 'PROCESSING' && (
                <div className="clothes-upload-page__analyzing-message">
                  <p>이미지를 처리하고 있습니다. 잠시만 기다려주세요.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <AlertModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="등록 취소"
        message="작성 중인 내용이 저장되지 않습니다. 취소하시겠습니까?"
        confirmText="취소하기"
        cancelText="계속 작성"
        onConfirm={() => navigate(-1)}
        danger
      />
    </div>
  );
};

export default ClothesUploadPage;