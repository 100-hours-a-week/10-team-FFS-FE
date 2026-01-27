import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Button, Input } from '../components/common';
import { validateNickname, fileToDataUrl, isValidUploadImage } from '../utils/helpers';
import { checkNickname, checkBirthDate, registerUser, uploadFiles } from '../api';
import { IoAdd, IoClose } from 'react-icons/io5';
import './AdditionalInfoPage.css';

const AdditionalInfoPage = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { success, error: showError } = useToast();
  const fileInputRef = useRef(null);
  const nicknameDebounceRef = useRef(null);
  const birthdayDebounceRef = useRef(null);

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

  const [birthdayStatus, setBirthdayStatus] = useState({
    checking: false,
    valid: null,
    message: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 컴포넌트 언마운트 시 디바운스 타이머 정리
  useEffect(() => {
    return () => {
      if (nicknameDebounceRef.current) {
        clearTimeout(nicknameDebounceRef.current);
      }
      if (birthdayDebounceRef.current) {
        clearTimeout(birthdayDebounceRef.current);
      }
    };
  }, []);

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

    // 이전 디바운스 타이머 취소
    if (nicknameDebounceRef.current) {
      clearTimeout(nicknameDebounceRef.current);
    }

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

    // 디바운스 적용하여 API 호출
    setNicknameStatus({ checking: true, available: null, message: '확인 중...' });

    nicknameDebounceRef.current = setTimeout(async () => {
      try {
        const response = await checkNickname(value);
        const { usable } = response.data;
        setNicknameStatus({
          checking: false,
          available: usable,
          message: usable ? '사용 가능한 닉네임입니다' : '중복된 닉네임 입니다',
        });
      } catch (err) {
        // 400 에러는 유효성 검사 실패 (서버 측)
        if (err.code === 400) {
          setNicknameStatus({
            checking: false,
            available: false,
            message: '닉네임은 띄어쓰기 및 특수문자 사용이 불가능하고 16자 미만으로 입력해야 합니다.',
          });
        } else {
          setNicknameStatus({
            checking: false,
            available: null,
            message: '확인 중 오류가 발생했습니다.',
          });
        }
      }
    }, 500);
  };

  // 생년월일 유효성 검사
  const handleBirthdayChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, birthday: value }));

    // 이전 디바운스 타이머 취소
    if (birthdayDebounceRef.current) {
      clearTimeout(birthdayDebounceRef.current);
    }

    if (!value) {
      setBirthdayStatus({ checking: false, valid: null, message: '' });
      return;
    }

    // 디바운스 적용하여 API 호출
    setBirthdayStatus({ checking: true, valid: null, message: '확인 중...' });

    birthdayDebounceRef.current = setTimeout(async () => {
      try {
        const response = await checkBirthDate(value);
        const { valid } = response.data;
        setBirthdayStatus({
          checking: false,
          valid: valid,
          message: valid ? '유효한 생년월일입니다' : '유효하지 않은 생년월일입니다',
        });
      } catch (err) {
        setBirthdayStatus({
          checking: false,
          valid: false,
          message: err.message || '확인 중 오류가 발생했습니다.',
        });
      }
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

    if (!birthdayStatus.valid) {
      showError('유효하지 않은 생년월일입니다.');
      return;
    }

    if (!formData.gender) {
      showError('성별을 선택해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      let profileFileId = null;

      // 프로필 이미지가 있으면 S3에 업로드
      if (formData.profileImage) {
        try {
          const fileIds = await uploadFiles('PROFILE', [formData.profileImage]);
          profileFileId = fileIds[0];
        } catch (uploadErr) {
          console.error('프로필 이미지 업로드 실패:', uploadErr);
          showError('프로필 이미지 업로드에 실패했습니다.');
          setIsSubmitting(false);
          return;
        }
      }

      // 회원가입 완료 API 호출
      await registerUser({
        nickname: formData.nickname,
        birthdate: formData.birthday,
        gender: formData.gender,
        profileFileId: profileFileId,
      });

      // 임시 토큰 삭제 및 로그아웃 처리
      logout();

      success('회원가입을 완료하였습니다');
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('회원가입 실패:', err);
      showError(err.message || '저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, nicknameStatus.available, birthdayStatus.valid, navigate, showError, success, logout]);

  const isFormValid = formData.nickname && nicknameStatus.available && formData.birthday && birthdayStatus.valid && formData.gender;

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
            {!formData.profilePreview && (
              <p className="additional-info-page__profile-hint">프로필 사진을 업로드 할 수 있습니다.</p>
            )}
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
            onChange={handleBirthdayChange}
            min="1900-01-01"
            max={new Date().toISOString().split('T')[0]}
            error={birthdayStatus.valid === false ? birthdayStatus.message : null}
            helperText={birthdayStatus.valid === true ? birthdayStatus.message : (birthdayStatus.checking ? '확인 중...' : null)}
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
            <option value="MALE">남성</option>
            <option value="FEMALE">여성</option>
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
