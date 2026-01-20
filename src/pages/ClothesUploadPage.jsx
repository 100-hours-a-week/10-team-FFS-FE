import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '../components/layout';
import { Button, Input, Spinner, AlertModal } from '../components/common';
import { useToast } from '../contexts/ToastContext';
import { categories } from '../mocks/data';
import { fileToDataUrl, isValidUploadImage, generateYearOptions, generateMonthOptions } from '../utils/helpers';
import { IoAdd, IoClose } from 'react-icons/io5';
import './ClothesUploadPage.css';

const ClothesUploadPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { success, error: showError } = useToast();
  const fileInputRef = useRef(null);
  const isCamera = searchParams.get('camera') === 'true';

  const [images, setImages] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  
  const [formData, setFormData] = useState({
    productName: '',
    brand: '',
    price: '',
    size: '',
    purchaseYear: '',
    purchaseMonth: '',
    category: '',
    materials: [],
    colors: [],
    styleTags: [],
  });

  const [newMaterial, setNewMaterial] = useState('');
  const [newColor, setNewColor] = useState('');

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

      // 첫 이미지 업로드 시 AI 분석 시작
      if (images.length === 0 && newImages.length > 0) {
        analyzeFirstImage(newImages[0].file);
      }
    } catch (err) {
      showError('이미지를 불러오는데 실패했습니다.');
    }

    // input 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // AI 이미지 분석
  const analyzeFirstImage = async (imageFile) => {
    setIsAnalyzing(true);
    try {
      // API 연동 필요: AI 옷 분석 API 호출
      // const result = await analyzeClothesImage(imageFile);
      
      // 목업: AI 분석 결과 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockAnalysisResult = {
        category: 'TOP',
        materials: ['면', '폴리에스터'],
        colors: ['화이트'],
        styleTags: ['#캐주얼', '#베이직'],
      };

      setFormData(prev => ({
        ...prev,
        category: mockAnalysisResult.category,
        materials: mockAnalysisResult.materials,
        colors: mockAnalysisResult.colors,
        styleTags: mockAnalysisResult.styleTags,
      }));
      
      success('AI 분석이 완료되었습니다.');
    } catch (err) {
      showError('AI 분석에 실패했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 이미지 삭제
  const handleImageRemove = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // 소재 추가
  const handleAddMaterial = () => {
    if (!newMaterial.trim()) return;
    if (formData.materials.includes(newMaterial.trim())) {
      showError('이미 추가된 소재입니다.');
      return;
    }
    setFormData(prev => ({
      ...prev,
      materials: [...prev.materials, newMaterial.trim()],
    }));
    setNewMaterial('');
  };

  // 소재 삭제
  const handleRemoveMaterial = (index) => {
    setFormData(prev => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== index),
    }));
  };

  // 색상 추가
  const handleAddColor = () => {
    if (!newColor.trim()) return;
    if (formData.colors.includes(newColor.trim())) {
      showError('이미 추가된 색상입니다.');
      return;
    }
    setFormData(prev => ({
      ...prev,
      colors: [...prev.colors, newColor.trim()],
    }));
    setNewColor('');
  };

  // 색상 삭제
  const handleRemoveColor = (index) => {
    setFormData(prev => ({
      ...prev,
      colors: prev.colors.filter((_, i) => i !== index),
    }));
  };

  // 폼 제출
  const handleSubmit = async () => {
    if (images.length === 0) {
      showError('이미지를 1장 이상 업로드해주세요.');
      return;
    }

    if (!formData.productName) {
      showError('제품명을 입력해주세요.');
      return;
    }

    if (!formData.category) {
      showError('카테고리를 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      // API 연동 필요: 옷 등록 API 호출
      // await uploadClothes({
      //   ...formData,
      //   images: images.map(img => img.file),
      // });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      success('옷이 등록되었습니다.');
      navigate('/closet');
    } catch (err) {
      showError('옷 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 취소 확인
  const handleCancel = () => {
    if (images.length > 0 || formData.productName) {
      setShowCancelModal(true);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="clothes-upload-page">
      <Header 
        showBack 
        onBack={handleCancel}
        title="옷 등록"
        rightElement={
          <Button 
            size="small" 
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={isAnalyzing}
          >
            등록
          </Button>
        }
      />

      <div className="clothes-upload-page__content">
        {/* 이미지 업로드 */}
        <div className="clothes-upload-page__section">
          <label className="clothes-upload-page__label">
            사진 ({images.length}/10)
          </label>
          <div className="clothes-upload-page__images">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg"
              multiple
              capture={isCamera ? 'environment' : undefined}
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            
            {/* 이미지 추가 버튼 */}
            {images.length < 10 && (
              <button 
                className="clothes-upload-page__image-add"
                onClick={() => fileInputRef.current?.click()}
              >
                <IoAdd size={32} />
              </button>
            )}

            {/* 업로드된 이미지들 */}
            {images.map((image, index) => (
              <div key={index} className="clothes-upload-page__image-item">
                <img src={image.preview} alt={`옷 ${index + 1}`} />
                <button 
                  className="clothes-upload-page__image-remove"
                  onClick={() => handleImageRemove(index)}
                >
                  <IoClose size={16} />
                </button>
                {index === 0 && (
                  <span className="clothes-upload-page__image-main">대표</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* AI 분석 중 표시 */}
        {isAnalyzing && (
          <div className="clothes-upload-page__analyzing">
            <Spinner size="small" />
            <span>AI가 옷을 분석하고 있습니다...</span>
          </div>
        )}

        {/* 기본 정보 */}
        <div className="clothes-upload-page__section">
          <Input
            label="제품명"
            required
            placeholder="제품명을 입력하세요"
            value={formData.productName}
            onChange={(e) => setFormData(prev => ({ ...prev, productName: e.target.value }))}
          />
        </div>

        <div className="clothes-upload-page__section">
          <Input
            label="브랜드"
            placeholder="브랜드를 입력하세요"
            value={formData.brand}
            onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
          />
        </div>

        <div className="clothes-upload-page__section">
          <Input
            label="가격"
            type="number"
            placeholder="가격을 입력하세요"
            value={formData.price}
            onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
          />
        </div>

        <div className="clothes-upload-page__section">
          <Input
            label="사이즈"
            placeholder="사이즈를 입력하세요"
            value={formData.size}
            onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
          />
        </div>

        {/* 구매 시기 */}
        <div className="clothes-upload-page__section">
          <label className="clothes-upload-page__label">구매 시기</label>
          <div className="clothes-upload-page__row">
            <select
              className="clothes-upload-page__select"
              value={formData.purchaseYear}
              onChange={(e) => setFormData(prev => ({ ...prev, purchaseYear: e.target.value }))}
            >
              <option value="">년도</option>
              {generateYearOptions().map(year => (
                <option key={year} value={year}>{year}년</option>
              ))}
            </select>
            <select
              className="clothes-upload-page__select"
              value={formData.purchaseMonth}
              onChange={(e) => setFormData(prev => ({ ...prev, purchaseMonth: e.target.value }))}
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
            <span className="clothes-upload-page__required">*</span>
            카테고리
          </label>
          <select
            className="clothes-upload-page__select clothes-upload-page__select--full"
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
          >
            <option value="">카테고리 선택</option>
            {categories.filter(c => c.id !== 'ALL').map(category => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>
        </div>

        {/* 소재 */}
        <div className="clothes-upload-page__section">
          <label className="clothes-upload-page__label">소재</label>
          <div className="clothes-upload-page__tags-container">
            <div className="clothes-upload-page__tags">
              {formData.materials.map((material, index) => (
                <span key={index} className="clothes-upload-page__tag">
                  {material}
                  <button 
                    className="clothes-upload-page__tag-remove"
                    onClick={() => handleRemoveMaterial(index)}
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
                  onKeyPress={(e) => e.key === 'Enter' && handleAddMaterial()}
                />
                <button 
                  className="clothes-upload-page__tag-add"
                  onClick={handleAddMaterial}
                >
                  <IoAdd size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 색상 */}
        <div className="clothes-upload-page__section">
          <label className="clothes-upload-page__label">색상</label>
          <div className="clothes-upload-page__tags-container">
            <div className="clothes-upload-page__tags">
              {formData.colors.map((color, index) => (
                <span key={index} className="clothes-upload-page__tag">
                  {color}
                  <button 
                    className="clothes-upload-page__tag-remove"
                    onClick={() => handleRemoveColor(index)}
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
                  onKeyPress={(e) => e.key === 'Enter' && handleAddColor()}
                />
                <button 
                  className="clothes-upload-page__tag-add"
                  onClick={handleAddColor}
                >
                  <IoAdd size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 스타일 태그 (수정 불가) */}
        <div className="clothes-upload-page__section">
          <label className="clothes-upload-page__label">
            스타일 태그 
            <span className="clothes-upload-page__label-hint">(AI 분석 결과 - 수정 불가)</span>
          </label>
          <div className="clothes-upload-page__tags">
            {formData.styleTags.length > 0 ? (
              formData.styleTags.map((tag, index) => (
                <span key={index} className="clothes-upload-page__tag clothes-upload-page__tag--readonly">
                  {tag}
                </span>
              ))
            ) : (
              <span className="clothes-upload-page__empty-tags">
                이미지 업로드 시 AI가 분석합니다
              </span>
            )}
          </div>
        </div>
      </div>

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
