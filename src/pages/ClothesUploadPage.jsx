import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { Button, Input, Spinner, AlertModal } from '../components/common';
import { useToast } from '../contexts/ToastContext';
import { getPresignedUrls, uploadToS3, requestClothesAnalysis, getClothesAnalysisResult, createClothes } from '../api';
import { fileToDataUrl, isValidUploadImage } from '../utils/helpers';
import { IoAdd, IoClose, IoChevronBack, IoChevronForward } from 'react-icons/io5';
import './ClothesUploadPage.css';

// 카테고리 목록
const CATEGORIES = [
  { id: 'TOP', label: '상의' },
  { id: 'BOTTOM', label: '하의' },
  { id: 'DRESS', label: '원피스' },
  { id: 'SHOES', label: '신발' },
  { id: 'ACCESSORY', label: '악세사리' },
  { id: 'ETC', label: '기타' },
];

// Polling 간격
const POLLING_INTERVAL = 3000;

const ClothesUploadPage = () => {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const fileInputRef = useRef(null);
  const pollingRef = useRef(null);

  // 현재 단계: 'upload' | 'analysis'
  const [step, setStep] = useState('upload');
  
  // 업로드 단계 상태
  const [images, setImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // 분석 단계 상태
  const [batchId, setBatchId] = useState(null);
  const [analysisResults, setAnalysisResults] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savedItems, setSavedItems] = useState(new Set()); // 저장 완료된 taskId들
  
  // 각 옷의 폼 데이터 (taskId를 키로 사용)
  const [formDataMap, setFormDataMap] = useState({});
  
  // 태그 입력 상태
  const [newMaterial, setNewMaterial] = useState('');
  const [newColor, setNewColor] = useState('');
  
  // 모달
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

  // 이미지 삭제
  const handleImageRemove = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // 분석하기 버튼 클릭
  const handleAnalyze = async () => {
    if (images.length === 0) {
      showError('이미지를 1장 이상 업로드해주세요.');
      return;
    }

    setIsUploading(true);
    try {
      // 1. Presigned URL 발급
      const files = images.map(img => ({
        name: img.file.name,
        type: img.file.type,
      }));
      
      const presignedResponse = await getPresignedUrls('CLOTHES_TEMP', files);
      const urls = presignedResponse.data;

      // 2. S3에 이미지 업로드
      const uploadPromises = urls.map((urlInfo, index) => 
        uploadToS3(urlInfo.presignedUrl, images[index].file)
      );
      await Promise.all(uploadPromises);

      // 3. 분석 요청 API 호출
      const fileIds = urls.map(urlInfo => urlInfo.fileId);
      const analysisResponse = await requestClothesAnalysis(fileIds);
      
      if (analysisResponse.code === 202) {
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

  // Polling으로 분석 결과 가져오기
  const fetchAnalysisResult = useCallback(async () => {
    if (!batchId) return;

    try {
      const response = await getClothesAnalysisResult(batchId);
      
      if (response.code === 200) {
        const { results, meta } = response.data;
        setAnalysisResults(results);

        // 각 결과에 대해 formDataMap 초기화/업데이트
        setFormDataMap(prev => {
          const newMap = { ...prev };
          results.forEach(result => {
            if (!newMap[result.taskId]) {
              // 초기화
              newMap[result.taskId] = {
                name: '',
                brand: '',
                price: '',
                size: '',
                purchaseYear: '',
                purchaseMonth: '',
                category: result.major?.category || '',
                materials: result.major?.material || [],
                colors: result.major?.color || [],
                styleTags: result.major?.styleTags || [],
                fileId: result.fileId,
                imageUrl: result.imageUrl,
              };
            } else {
              // 이미 있으면 AI 분석 결과만 업데이트 (사용자가 수정한 값은 유지)
              if (result.status === 'COMPLETED' && !newMap[result.taskId].aiUpdated) {
                newMap[result.taskId] = {
                  ...newMap[result.taskId],
                  category: newMap[result.taskId].category || result.major?.category || '',
                  materials: newMap[result.taskId].materials.length > 0 
                    ? newMap[result.taskId].materials 
                    : (result.major?.material || []),
                  colors: newMap[result.taskId].colors.length > 0 
                    ? newMap[result.taskId].colors 
                    : (result.major?.color || []),
                  styleTags: result.major?.styleTags || [],
                  fileId: result.fileId,
                  imageUrl: result.imageUrl,
                  aiUpdated: true,
                };
              } else {
                // imageUrl, fileId는 항상 업데이트
                newMap[result.taskId] = {
                  ...newMap[result.taskId],
                  fileId: result.fileId || newMap[result.taskId].fileId,
                  imageUrl: result.imageUrl || newMap[result.taskId].imageUrl,
                };
              }
            }
          });
          return newMap;
        });

        // 모든 분석이 완료되면 polling 중지
        if (meta.isFinished) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }
    } catch (err) {
      console.error('Polling failed:', err);
    }
  }, [batchId]);

  // Polling 시작
  useEffect(() => {
    if (step === 'analysis' && batchId) {
      // 즉시 한 번 호출
      fetchAnalysisResult();
      
      // 주기적으로 polling
      pollingRef.current = setInterval(fetchAnalysisResult, POLLING_INTERVAL);
      
      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [step, batchId, fetchAnalysisResult]);

  // 폼 데이터 업데이트
  const updateFormData = (taskId, field, value) => {
    setFormDataMap(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        [field]: value,
      },
    }));
  };

  // 소재 추가
  const handleAddMaterial = (taskId) => {
    if (!newMaterial.trim()) return;
    const currentMaterials = formDataMap[taskId]?.materials || [];
    if (currentMaterials.includes(newMaterial.trim())) {
      showError('이미 추가된 소재입니다.');
      return;
    }
    updateFormData(taskId, 'materials', [...currentMaterials, newMaterial.trim()]);
    setNewMaterial('');
  };

  // 소재 삭제
  const handleRemoveMaterial = (taskId, index) => {
    const currentMaterials = formDataMap[taskId]?.materials || [];
    updateFormData(taskId, 'materials', currentMaterials.filter((_, i) => i !== index));
  };

  // 색상 추가
  const handleAddColor = (taskId) => {
    if (!newColor.trim()) return;
    const currentColors = formDataMap[taskId]?.colors || [];
    if (currentColors.includes(newColor.trim())) {
      showError('이미 추가된 색상입니다.');
      return;
    }
    updateFormData(taskId, 'colors', [...currentColors, newColor.trim()]);
    setNewColor('');
  };

  // 색상 삭제
  const handleRemoveColor = (taskId, index) => {
    const currentColors = formDataMap[taskId]?.colors || [];
    updateFormData(taskId, 'colors', currentColors.filter((_, i) => i !== index));
  };

  // 개별 옷 저장
  const handleSaveItem = async (taskId) => {
    const result = analysisResults.find(r => r.taskId === taskId);
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
      // 구매일 포맷팅
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

      // 선택 필드들
      if (formData.name) requestBody.name = formData.name;
      if (formData.brand) requestBody.brand = formData.brand;
      if (formData.price) requestBody.price = Number(formData.price);
      if (formData.size) requestBody.size = formData.size;
      if (boughtDate) requestBody.boughtDate = boughtDate;
      if (formData.materials.length > 0) requestBody.material = formData.materials;
      if (formData.colors.length > 0) requestBody.color = formData.colors;

      await createClothes(requestBody);
      
      setSavedItems(prev => new Set([...prev, taskId]));
      success('옷이 저장되었습니다.');

      // 모든 COMPLETED 항목이 저장되었는지 확인
      const completedResults = analysisResults.filter(r => r.status === 'COMPLETED');
      const allSaved = completedResults.every(r => 
        savedItems.has(r.taskId) || r.taskId === taskId
      );
      
      if (allSaved && completedResults.length > 0) {
        // 모든 항목 저장 완료 시 옷장으로 이동
        setTimeout(() => {
          navigate(-1);
        }, 500);
      }
    } catch (err) {
      console.error('Save failed:', err);
      showError(err.message || '저장에 실패했습니다.');
    }
  };

  // 캐러셀 네비게이션
  const goToPrevious = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
    setNewMaterial('');
    setNewColor('');
  };

  const goToNext = () => {
    setCurrentIndex(prev => Math.min(analysisResults.length - 1, prev + 1));
    setNewMaterial('');
    setNewColor('');
  };

  // 취소 확인
  const handleCancel = () => {
    if (images.length > 0 || step === 'analysis') {
      setShowCancelModal(true);
    } else {
      navigate(-1);
    }
  };

  // 년도 옵션 생성
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= currentYear - 20; year--) {
      years.push(year);
    }
    return years;
  };

  // 월 옵션 생성
  const generateMonthOptions = () => {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  };

  // 현재 분석 결과
  const currentResult = analysisResults[currentIndex];
  const currentFormData = currentResult ? formDataMap[currentResult.taskId] : null;
  const isCurrentSaved = currentResult ? savedItems.has(currentResult.taskId) : false;

  return (
    <div className="clothes-upload-page">
      <Header 
        showBack 
        onBack={handleCancel}
        title="옷 등록"
      />

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
            <Button
              fullWidth
              onClick={handleAnalyze}
              loading={isUploading}
              disabled={images.length === 0}
            >
              분석하기
            </Button>
          </div>
        </div>
      )}

      {/* 분석 결과 단계 */}
      {step === 'analysis' && (
        <div className="clothes-upload-page__content">
          {analysisResults.length === 0 ? (
            <div className="clothes-upload-page__loading">
              <Spinner />
              <span>분석 준비 중...</span>
            </div>
          ) : (
            <>
              {/* 캐러셀 네비게이션 */}
              <div className="clothes-upload-page__carousel">
                <button 
                  className="clothes-upload-page__nav-btn"
                  onClick={goToPrevious}
                  disabled={currentIndex === 0}
                >
                  <IoChevronBack size={24} />
                </button>

                <div className="clothes-upload-page__slide">
                  {/* 이미지 영역 */}
                  <div className="clothes-upload-page__image-container">
                    {currentResult?.status === ('PREPROCESSING' || 'ANALYZING') && (
                      <div className="clothes-upload-page__image-loading">
                        <Spinner />
                        <span>이미지 처리 중...</span>
                      </div>
                    )}
                    {/*
                    {currentResult?.status === 'ANALYZING' && (
                      <>
                        <img 
                          src={currentResult.imageUrl} 
                          alt="옷" 
                          className="clothes-upload-page__main-image"
                        />
                        <div className="clothes-upload-page__analyzing-overlay">
                          <Spinner size="small" />
                          <span>AI 분석 중...</span>
                        </div>
                      </>
                    )}
                    */}
                    
                    {currentResult?.status === 'COMPLETED' && (
                      <img 
                        src={currentResult.imageUrl} 
                        alt="옷" 
                        className="clothes-upload-page__main-image"
                      />
                    )}
                    {currentResult?.status === 'FAILED' && (
                      <div className="clothes-upload-page__image-failed">
                        <span>분석 실패</span>
                        <p>이 이미지는 분석할 수 없습니다.</p>
                      </div>
                    )}
                  </div>

                  {/* 페이지 인디케이터 */}
                  <div className="clothes-upload-page__indicators">
                    {analysisResults.map((_, index) => (
                      <span 
                        key={index} 
                        className={`clothes-upload-page__indicator ${
                          index === currentIndex ? 'clothes-upload-page__indicator--active' : ''
                        } ${
                          savedItems.has(analysisResults[index]?.taskId) 
                            ? 'clothes-upload-page__indicator--saved' 
                            : ''
                        }`}
                        onClick={() => setCurrentIndex(index)}
                      />
                    ))}
                  </div>
                </div>

                <button 
                  className="clothes-upload-page__nav-btn"
                  onClick={goToNext}
                  disabled={currentIndex === analysisResults.length - 1}
                >
                  <IoChevronForward size={24} />
                </button>
              </div>

              {/* 폼 영역 - COMPLETED 상태일 때만 표시 */}
              {currentResult?.status === 'COMPLETED' && currentFormData && !isCurrentSaved && (
                <div className="clothes-upload-page__form">
                  {/* 제품명 */}
                  <div className="clothes-upload-page__section">
                    <Input
                      label="제품명"
                      placeholder="제품명을 입력하세요"
                      value={currentFormData.name}
                      onChange={(e) => updateFormData(currentResult.taskId, 'name', e.target.value)}
                    />
                  </div>

                  {/* 브랜드 */}
                  <div className="clothes-upload-page__section">
                    <Input
                      label="브랜드"
                      placeholder="브랜드를 입력하세요"
                      value={currentFormData.brand}
                      onChange={(e) => updateFormData(currentResult.taskId, 'brand', e.target.value)}
                    />
                  </div>

                  {/* 가격 */}
                  <div className="clothes-upload-page__section">
                    <Input
                      label="가격"
                      type="number"
                      placeholder="가격을 입력하세요"
                      value={currentFormData.price}
                      onChange={(e) => updateFormData(currentResult.taskId, 'price', e.target.value)}
                    />
                  </div>

                  {/* 사이즈 */}
                  <div className="clothes-upload-page__section">
                    <Input
                      label="사이즈"
                      placeholder="사이즈를 입력하세요"
                      value={currentFormData.size}
                      onChange={(e) => updateFormData(currentResult.taskId, 'size', e.target.value)}
                    />
                  </div>

                  {/* 구매년월 */}
                  <div className="clothes-upload-page__section">
                    <label className="clothes-upload-page__label">구매년월</label>
                    <div className="clothes-upload-page__row">
                      <select
                        className="clothes-upload-page__select"
                        value={currentFormData.purchaseYear}
                        onChange={(e) => updateFormData(currentResult.taskId, 'purchaseYear', e.target.value)}
                      >
                        <option value="">년도</option>
                        {generateYearOptions().map(year => (
                          <option key={year} value={year}>{year}년</option>
                        ))}
                      </select>
                      <select
                        className="clothes-upload-page__select"
                        value={currentFormData.purchaseMonth}
                        onChange={(e) => updateFormData(currentResult.taskId, 'purchaseMonth', e.target.value)}
                      >
                        <option value="">월</option>
                        {generateMonthOptions().map(month => (
                          <option key={month} value={month}>{month}월</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 카테고리 */}
                  <div className="clothes-upload-page__section">
                    <label className="clothes-upload-page__label">
                      카테고리
                    </label>
                    <div className="clothes-upload-page__categories">
                      {CATEGORIES.map(category => (
                        <button
                          key={category.id}
                          className={`clothes-upload-page__category-btn ${
                            currentFormData.category === category.id 
                              ? 'clothes-upload-page__category-btn--active' 
                              : ''
                          }`}
                          onClick={() => updateFormData(currentResult.taskId, 'category', category.id)}
                        >
                          {category.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 소재 */}
                  <div className="clothes-upload-page__section">
                    <label className="clothes-upload-page__label">소재</label>
                      <div className="clothes-upload-page__tags">
                        {currentFormData.materials.map((material, index) => (
                          <span key={index} className="clothes-upload-page__tag">
                            {material}
                            <button 
                              className="clothes-upload-page__tag-remove"
                              onClick={() => handleRemoveMaterial(currentResult.taskId, index)}
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
                            onKeyPress={(e) => e.key === 'Enter' && handleAddMaterial(currentResult.taskId)}
                          />
                          <button 
                            className="clothes-upload-page__tag-add"
                            onClick={() => handleAddMaterial(currentResult.taskId)}
                          >
                            <IoAdd size={20} />
                          </button>
                        </div>
                      </div>
                  </div>

                  {/* 색상 */}
                  <div className="clothes-upload-page__section">
                    <label className="clothes-upload-page__label">색</label>
                      <div className="clothes-upload-page__tags">
                        {currentFormData.colors.map((color, index) => (
                          <span key={index} className="clothes-upload-page__tag">
                            {color}
                            <button 
                              className="clothes-upload-page__tag-remove"
                              onClick={() => handleRemoveColor(currentResult.taskId, index)}
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
                            onKeyPress={(e) => e.key === 'Enter' && handleAddColor(currentResult.taskId)}
                          />
                          <button 
                            className="clothes-upload-page__tag-add"
                            onClick={() => handleAddColor(currentResult.taskId)}
                          >
                            <IoAdd size={20} />
                          </button>
                        </div>
                      </div>
                  </div>

                  {/* 스타일 태그 */}
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
                        <span className="clothes-upload-page__empty-tags">
                          스타일 태그 없음
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 저장 버튼 */}
                  <div className="clothes-upload-page__action">
                    <Button
                      fullWidth
                      onClick={() => handleSaveItem(currentResult.taskId)}
                    >
                      옷 정보 추가 완료
                    </Button>
                  </div>
                </div>
              )}

              {/* 저장 완료된 항목 */}
              {isCurrentSaved && (
                <div className="clothes-upload-page__saved-message">
                  <span>✓ 저장 완료</span>
                  <p>이 옷은 이미 저장되었습니다.</p>
                </div>
              )}

              {/* ANALYZING 상태일 때 메시지 */}
              {currentResult?.status === 'ANALYZING' && (
                <div className="clothes-upload-page__analyzing-message">
                  <p>AI가 옷을 분석하고 있습니다. 잠시만 기다려주세요.</p>
                </div>
              )}

              {/* PREPROCESSING 상태일 때 메시지 */}
              {currentResult?.status === 'PREPROCESSING' && (
                <div className="clothes-upload-page__analyzing-message">
                  <p>이미지를 처리하고 있습니다. 잠시만 기다려주세요.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 취소 확인 모달 */}
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