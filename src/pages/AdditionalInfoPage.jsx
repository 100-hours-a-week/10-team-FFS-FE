import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Button, Input } from '../components/common';
import { validateNickname, fileToDataUrl, isValidUploadImage } from '../utils/helpers';
import { IoAdd, IoClose } from 'react-icons/io5';
import './AdditionalInfoPage.css';

const AdditionalInfoPage = () => {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const { success, error: showError } = useToast();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    profileImage: null,
    profilePreview: null,
    nickname: '',
    birthday: '',
    gender: '',
  });
  
  const [nicknameStatus, setNicknameStatus] = useState({
    checking: false,
    available: null,
    message: '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 프로필 이미지 선택
  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isValidUploadImage(file)) {
      showError('PNG, JPEG 파일만 업로드 가능합니다.');
      return;
    }

    try {
      const preview = await fileToDataUrl(file);
      setFormData(prev => ({
        ...prev,
        profileImage: file,
        profilePreview: preview,
      }));
    } catch (err) {
      showError('이미지를 불러오는데 실패했습니다.');
    }
  };

  // 프로필 이미지 삭제
  const handleImageRemove = () => {
    setFormData(prev => ({
      ...prev,
      profileImage: null,
      profilePreview: null,
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 닉네임 유효성 검사
  const handleNicknameChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, nickname: value }));
    
    if (!value) {
      setNicknameStatus({ checking: false, available: null, message: '' });
      return;
    }

    const validation = validateNickname(value);
    if (!validation.isValid) {
      setNicknameStatus({
        checking: false,
        available: false,
        message: validation.errors[0],
      });
      return;
    }

    // API 연동 필요: 닉네임 중복 확인
    setNicknameStatus({ checking: true, available: null, message: '확인 중...' });
    
    // 목업: 닉네임 중복 확인 시뮬레이션
    setTimeout(() => {
      const isDuplicate = value === 'duplicate'; // 테스트용
      setNicknameStatus({
        checking: false,
        available: !isDuplicate,
        message: isDuplicate ? '중복된 닉네임 입니다' : '사용 가능한 닉네임입니다',
      });
    }, 500);
  };

  // 폼 제출
  const handleSubmit = useCallback(async () => {
    // 필수 항목 검증
    if (!formData.nickname) {
      showError('닉네임을 입력해주세요.');
      return;
    }
    
    if (!nicknameStatus.available) {
      showError('사용할 수 없는 닉네임입니다.');
      return;
    }

    if (!formData.birthday) {
      showError('생일을 입력해주세요.');
      return;
    }

    if (!formData.gender) {
      showError('성별을 선택해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      // API 연동 필요: 추가정보 저장 API 호출
      // await submitAdditionalInfo(formData);
      
      // 목업: 저장 성공 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      updateUser({
        nickname: formData.nickname,
        birthday: formData.birthday,
        gender: formData.gender,
        profileImage: formData.profilePreview,
        isNewUser: false,
      });

      success('회원가입을 완료하였습니다');
      navigate('/login');
    } catch (err) {
      showError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, nicknameStatus.available, navigate, showError, success, updateUser]);

  const isFormValid = formData.nickname && nicknameStatus.available && formData.birthday && formData.gender;

  return (
    <div className="additional-info-page">
      <div className="additional-info-page__content">
        <h1 className="additional-info-page__title">추가 정보 입력</h1>

        {/* 프로필 사진 */}
        <div className="additional-info-page__section">
          <label className="additional-info-page__label">프로필</label>
          <div className="additional-info-page__profile">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            <div 
              className="additional-info-page__profile-image"
              onClick={() => fileInputRef.current?.click()}
            >
              {formData.profilePreview ? (
                <>
                  <img src={formData.profilePreview} alt="프로필" />
                  <button 
                    className="additional-info-page__profile-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleImageRemove();
                    }}
                  >
                    <IoClose size={16} />
                  </button>
                </>
              ) : (
                <IoAdd size={32} className="additional-info-page__profile-add" />
              )}
            </div>
            <p className="additional-info-page__profile-hint">프로필 사진을 업로드 하세요</p>
          </div>
        </div>

        {/* 닉네임 */}
        <div className="additional-info-page__section">
          <Input
            label="닉네임"
            required
            placeholder="닉네임을 입력하세요"
            value={formData.nickname}
            onChange={handleNicknameChange}
            maxLength={16}
            error={nicknameStatus.available === false ? nicknameStatus.message : null}
            helperText={nicknameStatus.available === true ? nicknameStatus.message : null}
          />
        </div>

        {/* 생일 */}
        <div className="additional-info-page__section">
          <Input
            label="생일"
            required
            type="date"
            placeholder="생일을 입력하세요"
            value={formData.birthday}
            onChange={(e) => setFormData(prev => ({ ...prev, birthday: e.target.value }))}
          />
        </div>

        {/* 성별 */}
        <div className="additional-info-page__section">
          <label className="additional-info-page__label">
            <span className="additional-info-page__required">*</span>
            성별
          </label>
          <select
            className="additional-info-page__select"
            value={formData.gender}
            onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
          >
            <option value="">성별을 선택하세요</option>
            <option value="남성">남성</option>
            <option value="여성">여성</option>
            <option value="기타">기타</option>
          </select>
        </div>

        {/* 제출 버튼 */}
        <div className="additional-info-page__submit">
          <Button
            fullWidth
            size="large"
            disabled={!isFormValid}
            loading={isSubmitting}
            onClick={handleSubmit}
          >
            회원가입 완료
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdditionalInfoPage;
