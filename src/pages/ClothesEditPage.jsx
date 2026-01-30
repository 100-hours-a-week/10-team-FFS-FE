import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { Button, Input, Spinner, AlertModal } from '../components/common';
import { useToast } from '../contexts/ToastContext';
import { getClothesDetail, updateClothes } from '../api';
import { IoAdd, IoClose } from 'react-icons/io5';
import './ClothesEditPage.css';

// 카테고리 목록
const CATEGORIES = [
  { id: 'TOP', label: '상의' },
  { id: 'BOTTOM', label: '하의' },
  { id: 'DRESS', label: '원피스' },
  { id: 'SHOES', label: '신발' },
  { id: 'ACCESSORY', label: '악세사리' },
  { id: 'ETC', label: '기타' },
];

const ClothesEditPage = () => {
  const { clothesId } = useParams();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [styleTags, setStyleTags] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    price: '',
    size: '',
    purchaseYear: '',
    purchaseMonth: '',
    category: '',
    materials: [],
    colors: [],
  });

  const [newMaterial, setNewMaterial] = useState('');
  const [newColor, setNewColor] = useState('');

  // 기존 데이터 로드
  useEffect(() => {
    const loadClothes = async () => {
      setIsLoading(true);
      try {
        const response = await getClothesDetail(clothesId);
        if (response.code === 200) {
          const data = response.data;
          
          // 구매일 파싱
          let purchaseYear = '';
          let purchaseMonth = '';
          if (data.boughtDate) {
            const date = new Date(data.boughtDate);
            purchaseYear = date.getFullYear().toString();
            purchaseMonth = (date.getMonth() + 1).toString();
          }

          setFormData({
            name: data.name || '',
            brand: data.brand || '',
            price: data.price ? data.price.toString() : '',
            size: data.size || '',
            purchaseYear,
            purchaseMonth,
            category: data.category || '',
            materials: data.material || [],
            colors: data.color || [],
          });
          setImageUrl(data.clothesImageUrl || '');
          setStyleTags(data.styleTag || []);
        } else {
          showError('옷 정보를 찾을 수 없습니다.');
          navigate(-1);
        }
      } catch (err) {
        console.error('Failed to load clothes:', err);
        showError('옷 정보를 불러오는데 실패했습니다.');
        navigate(-1);
      } finally {
        setIsLoading(false);
      }
    };

    loadClothes();
  }, [clothesId, navigate, showError]);

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
    if (!formData.category) {
      showError('카테고리를 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 변경된 필드만 전송
      const requestBody = {};

      if (formData.name) requestBody.name = formData.name;
      if (formData.brand) requestBody.brand = formData.brand;
      if (formData.price) requestBody.price = Number(formData.price);
      if (formData.size) requestBody.size = formData.size;
      if (formData.category) requestBody.category = formData.category;
      
      // 구매일 포맷팅
      if (formData.purchaseYear && formData.purchaseMonth) {
        requestBody.boughtDate = `${formData.purchaseYear}-${String(formData.purchaseMonth).padStart(2, '0')}-01`;
      }
      
      if (formData.materials.length > 0) {
        requestBody.material = formData.materials;
      }
      
      if (formData.colors.length > 0) {
        requestBody.color = formData.colors;
      }

      await updateClothes(clothesId, requestBody);
      success('옷 정보가 수정되었습니다.');
      navigate(`/clothes/${clothesId}`);
    } catch (err) {
      console.error('Update failed:', err);
      showError(err.message || '수정에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 취소 확인
  const handleCancel = () => {
    setShowCancelModal(true);
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

  if (isLoading) {
    return (
      <div className="clothes-edit-page">
        <Header showBack title="옷 수정" />
        <div className="clothes-edit-page__loading">
          <Spinner size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className="clothes-edit-page">
      <Header 
        showBack 
        onBack={handleCancel}
        title="옷 수정"
        rightElement={
          <Button 
            size="small" 
            onClick={handleSubmit}
            loading={isSubmitting}
          >
            저장
          </Button>
        }
      />

      <div className="clothes-edit-page__content">
        {/* 이미지 미리보기 */}
        {imageUrl && (
          <div className="clothes-edit-page__image-section">
            <img 
              src={imageUrl} 
              alt="옷" 
              className="clothes-edit-page__image"
            />
          </div>
        )}

        {/* 제품명 */}
        <div className="clothes-edit-page__section">
          <Input
            label="제품명"
            placeholder="제품명을 입력하세요"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          />
        </div>

        {/* 브랜드 */}
        <div className="clothes-edit-page__section">
          <Input
            label="브랜드"
            placeholder="브랜드를 입력하세요"
            value={formData.brand}
            onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
          />
        </div>

        {/* 가격 */}
        <div className="clothes-edit-page__section">
          <Input
            label="가격"
            type="number"
            placeholder="가격을 입력하세요"
            value={formData.price}
            onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
          />
        </div>

        {/* 사이즈 */}
        <div className="clothes-edit-page__section">
          <Input
            label="사이즈"
            placeholder="사이즈를 입력하세요"
            value={formData.size}
            onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
          />
        </div>

        {/* 구매년월 */}
        <div className="clothes-edit-page__section">
          <label className="clothes-edit-page__label">구매년월</label>
          <div className="clothes-edit-page__row">
            <select
              className="clothes-edit-page__select"
              value={formData.purchaseYear}
              onChange={(e) => setFormData(prev => ({ ...prev, purchaseYear: e.target.value }))}
            >
              <option value="">년도</option>
              {generateYearOptions().map(year => (
                <option key={year} value={year}>{year}년</option>
              ))}
            </select>
            <select
              className="clothes-edit-page__select"
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
        <div className="clothes-edit-page__section">
          <label className="clothes-edit-page__label">
            <span className="clothes-edit-page__required">*</span>
            카테고리
          </label>
          <div className="clothes-edit-page__categories">
            {CATEGORIES.map(category => (
              <button
                key={category.id}
                className={`clothes-edit-page__category-btn ${
                  formData.category === category.id 
                    ? 'clothes-edit-page__category-btn--active' 
                    : ''
                }`}
                onClick={() => setFormData(prev => ({ ...prev, category: category.id }))}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {/* 소재 */}
        <div className="clothes-edit-page__section">
          <label className="clothes-edit-page__label">소재</label>
            <div className="clothes-edit-page__tags">
              {formData.materials.map((material, index) => (
                <span key={index} className="clothes-edit-page__tag">
                  {material}
                  <button 
                    className="clothes-edit-page__tag-remove"
                    onClick={() => handleRemoveMaterial(index)}
                  >
                    <IoClose size={14} />
                  </button>
                </span>
              ))}
              <div className="clothes-edit-page__tag-input-wrapper">
                <input
                  type="text"
                  className="clothes-edit-page__tag-input"
                  placeholder="소재 입력"
                  value={newMaterial}
                  onChange={(e) => setNewMaterial(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddMaterial()}
                />
                <button 
                  className="clothes-edit-page__tag-add"
                  onClick={handleAddMaterial}
                >
                  <IoAdd size={20} />
                </button>
              </div>
            </div>
        </div>

        {/* 색상 */}
        <div className="clothes-edit-page__section">
          <label className="clothes-edit-page__label">색</label>
            <div className="clothes-edit-page__tags">
              {formData.colors.map((color, index) => (
                <span key={index} className="clothes-edit-page__tag">
                  {color}
                  <button 
                    className="clothes-edit-page__tag-remove"
                    onClick={() => handleRemoveColor(index)}
                  >
                    <IoClose size={14} />
                  </button>
                </span>
              ))}
              <div className="clothes-edit-page__tag-input-wrapper">
                <input
                  type="text"
                  className="clothes-edit-page__tag-input"
                  placeholder="색상 입력"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddColor()}
                />
                <button 
                  className="clothes-edit-page__tag-add"
                  onClick={handleAddColor}
                >
                  <IoAdd size={20} />
                </button>
              </div>
            </div>
        </div>

        {/* 스타일 태그 (수정 불가) */}
        <div className="clothes-edit-page__section">
          <label className="clothes-edit-page__label">
            스타일태그
            <span className="clothes-edit-page__label-hint">(수정 불가)</span>
          </label>
          <div className="clothes-edit-page__tags">
            {styleTags.length > 0 ? (
              styleTags.map((tag, index) => (
                <span key={index} className="clothes-edit-page__tag clothes-edit-page__tag--readonly">
                  #{tag}
                </span>
              ))
            ) : (
              <span className="clothes-edit-page__empty-tags">
                스타일 태그 없음
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 취소 확인 모달 */}
      <AlertModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="수정 취소"
        message="수정 중인 내용이 저장되지 않습니다. 취소하시겠습니까?"
        confirmText="취소하기"
        cancelText="계속 수정"
        onConfirm={() => navigate(-1)}
        danger
      />
    </div>
  );
};

export default ClothesEditPage;