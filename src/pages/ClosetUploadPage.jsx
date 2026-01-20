import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '../components/layout';
import { Button, Spinner } from '../components/common';
import { useToast } from '../contexts/ToastContext';
import { fileToDataUrl, isValidUploadImage } from '../utils/helpers';
import { categories } from '../mocks/data';
import { IoClose, IoAdd } from 'react-icons/io5';
import './ClosetUploadPage.css';

const ClosetUploadPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isCamera = searchParams.get('camera') === 'true';
  const { success, error: showError } = useToast();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [images, setImages] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    productName: '',
    brand: '',
    price: '',
    size: '',
    purchaseYear: new Date().getFullYear().toString(),
    purchaseMonth: (new Date().getMonth() + 1).toString(),
    category: '',
    materials: [],
    colors: [],
    styleTags: [],
  });

  // 카메라 모드인 경우 자동으로 카메라 열기
  useEffect(() => {
    if (isCamera && cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  }, [isCamera]);

  // 이미지 선택
  const handleImageSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    
    if (images.length + files.length > 10) {
      showError('이미지는 최대 10장까지 업로드 가능합니다.');
      return;
    }

    const validFiles = files.filter(file => {
      if (!isValidUploadImage(file)) {
        showError(`${file.name}은(는) 지원하지 않는 형식입니다.`);
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

      // 첫 이미지 업로드 시 AI 분석 요청
      if (images.length === 0 && newImages.length > 0) {
        analyzeImage(newImages[0].file);
      }
    } catch (err) {
      showError('이미지를 불러오는데 실패했습니다.');
    }
  };

  // AI 이미지 분석
  const analyzeImage = async (file) => {
    setIsAnalyzing(true);
    try {
      // API 연동 필요: AI 옷 분석 요청
      // const result = await analyzeClothesImage(file);
      
      // 목업: AI 분석 결과 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockAnalysis = {
        category: 'TOP',
        materials: ['면', '폴리에스터'],
        colors: ['화이트'],
        styleTags: ['#캐주얼', '#베이직'],
      };

      setFormData(prev => ({
        ...prev,
        category: mockAnalysis.category,
        materials: mockAnalysis.materials,
        colors: mockAnalysis.colors,
        styleTags: mockAnalysis.styleTags,
      }));

      success('AI 분석이 완료되었습니다');
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

  // 소재/색상 추가
  const handleAddTag = (field) => {
    const value = prompt(`${field === 'materials' ? '소재' : '색상'}를 입력하세요`);
    if (value && value.trim()) {
      setFormData(prev => ({
        ...prev,
        [field]: [...prev[field], value.trim()]
      }));
    }
  };

  // 소재/색상 삭제
  const handleRemoveTag = (field, index) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  // 폼 제출
  const handleSubmit = async () => {
    if (images.length === 0) {
      showError('이미지를 최소 1장 업로드해주세요.');
      return;
    }

    if (!formData.productName) {
      showError('상품명을 입력해주세요.');
      return;
    }

    if (!formData.category) {
      showError('카테고리를 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      // API 연동 필요: 옷 등록 API
      // await uploadClothes({
      //   ...formData,
      //   images: images.map(img => img.file),
      // });

      // 목업: 등록 성공 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 1000));

      success('옷이 등록되었습니다');
      navigate('/closet');
    } catch (err) {
      showError('등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="closet-upload-page">
      <Header 
        showBack 
        title="옷 등록"
        rightElement={
          <Button 
            size="small" 
            disabled={isSubmitting || isAnalyzing}
            loading={isSubmitting}
            onClick={handleSubmit}
          >
            등록
          </Button>
        }
      />

      <div className="closet-upload-page__content">
        {/* 이미지 업로드 영역 */}
        <div className="closet-upload-page__section">
          <label className="closet-upload-page__label">
            사진 ({images.length}/10)
          </label>
          <div className="closet-upload-page__images">
            {images.map((img, index) => (
              <div key={index} className="closet-upload-page__image-item">
                <img src={img.preview} alt={`옷 ${index + 1}`} />
                <button 
                  className="closet-upload-page__image-remove"
                  onClick={() => handleImageRemove(index)}
                >
                  <IoClose size={16} />
                </button>
              </div>
            ))}
            
            {images.length < 10 && (
              <>
                <button 
                  className="closet-upload-page__image-add"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <IoAdd size={32} />
                  <span>사진 추가</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg"
                  multiple
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
              </>
            )}
          </div>
        </div>

        {/* AI 분석 중 표시 */}
        {isAnalyzing && (
          <div className="closet-upload-page__analyzing">
            <Spinner size="medium" />
            <span>AI가 옷을 분석하고 있습니다...</span>
          </div>
        )}

        {/* 상품명 */}
        <div className="closet-upload-page__section">
          <label className="closet-upload-page__label">
            <span className="closet-upload-page__required">*</span>
            상품명
          </label>
          <input
            type="text"
            className="closet-upload-page__input"
            placeholder="상품명을 입력하세요"
            value={formData.productName}
            onChange={(e) => setFormData(prev => ({ ...prev, productName: e.target.value }))}
          />
        </div>

        {/* 브랜드 */}
        <div className="closet-upload-page__section">
          <label className="closet-upload-page__label">브랜드</label>
          <input
            type="text"
            className="closet-upload-page__input"
            placeholder="브랜드를 입력하세요"
            value={formData.brand}
            onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
          />
        </div>

        {/* 가격 */}
        <div className="closet-upload-page__section">
          <label className="closet-upload-page__label">가격</label>
          <input
            type="text"
            className="closet-upload-page__input"
            placeholder="가격을 입력하세요"
            value={formData.price}
            onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
          />
        </div>

        {/* 사이즈 */}
        <div className="closet-upload-page__section">
          <label className="closet-upload-page__label">사이즈</label>
          <input
            type="text"
            className="closet-upload-page__input"
            placeholder="사이즈를 입력하세요"
            value={formData.size}
            onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
          />
        </div>

        {/* 구매일 */}
        <div className="closet-upload-page__section">
          <label className="closet-upload-page__label">구매일</label>
          <div className="closet-upload-page__row">
            <select
              className="closet-upload-page__select"
              value={formData.purchaseYear}
              onChange={(e) => setFormData(prev => ({ ...prev, purchaseYear: e.target.value }))}
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year}>{year}년</option>
              ))}
            </select>
            <select
              className="closet-upload-page__select"
              value={formData.purchaseMonth}
              onChange={(e) => setFormData(prev => ({ ...prev, purchaseMonth: e.target.value }))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>{month}월</option>
              ))}
            </select>
          </div>
        </div>

        {/* 카테고리 */}
        <div className="closet-upload-page__section">
          <label className="closet-upload-page__label">
            <span className="closet-upload-page__required">*</span>
            카테고리
          </label>
          <select
            className="closet-upload-page__select closet-upload-page__select--full"
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
        <div className="closet-upload-page__section">
          <label className="closet-upload-page__label">소재</label>
          <div className="closet-upload-page__tags">
            {formData.materials.map((material, index) => (
              <span key={index} className="closet-upload-page__tag">
                {material}
                <button 
                  className="closet-upload-page__tag-remove"
                  onClick={() => handleRemoveTag('materials', index)}
                >
                  ×
                </button>
              </span>
            ))}
            <button 
              className="closet-upload-page__tag-add"
              onClick={() => handleAddTag('materials')}
            >
              +
            </button>
          </div>
        </div>

        {/* 색상 */}
        <div className="closet-upload-page__section">
          <label className="closet-upload-page__label">색상</label>
          <div className="closet-upload-page__tags">
            {formData.colors.map((color, index) => (
              <span key={index} className="closet-upload-page__tag">
                {color}
                <button 
                  className="closet-upload-page__tag-remove"
                  onClick={() => handleRemoveTag('colors', index)}
                >
                  ×
                </button>
              </span>
            ))}
            <button 
              className="closet-upload-page__tag-add"
              onClick={() => handleAddTag('colors')}
            >
              +
            </button>
          </div>
        </div>

        {/* 스타일 태그 (AI 분석 결과, 수정 불가) */}
        <div className="closet-upload-page__section">
          <label className="closet-upload-page__label">
            스타일 태그
            <span className="closet-upload-page__hint">(AI 분석 결과, 수정 불가)</span>
          </label>
          <div className="closet-upload-page__tags">
            {formData.styleTags.length > 0 ? (
              formData.styleTags.map((tag, index) => (
                <span key={index} className="closet-upload-page__tag closet-upload-page__tag--readonly">
                  {tag}
                </span>
              ))
            ) : (
              <span className="closet-upload-page__tags-empty">
                이미지 업로드 후 AI가 분석합니다
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClosetUploadPage;
