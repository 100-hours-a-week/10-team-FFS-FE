import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { Button, Input, AlertModal } from '../components/common';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { fileToDataUrl, isValidUploadImage, validateNickname } from '../utils/helpers';
import { IoCamera } from 'react-icons/io5';
import './MyPageEdit.css';

const MyPageEdit = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const { success, error: showError } = useToast();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    profileImage: user?.profileImage || null,
    nickname: user?.nickname || '',
  });
  const [, setNewProfileImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [nicknameError, setNicknameError] = useState('');

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
      setNewProfileImage(file);
      setFormData(prev => ({ ...prev, profileImage: preview }));
    } catch (err) {
      showError('이미지를 불러오는데 실패했습니다.');
    }
  };

  // 닉네임 변경
  const handleNicknameChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, nickname: value }));

    if (value) {
      const validation = validateNickname(value);
      setNicknameError(validation.isValid ? '' : validation.errors[0]);
    } else {
      setNicknameError('');
    }
  };

  // 저장
  const handleSave = async () => {
    if (!formData.nickname) {
      showError('닉네임을 입력해주세요.');
      return;
    }

    if (nicknameError) {
      showError(nicknameError);
      return;
    }

    setIsSubmitting(true);
    try {
      // API 연동 필요: 프로필 수정 API
      // await updateMyProfile({
      //   nickname: formData.nickname,
      //   profileImage: newProfileImage,
      // });

      updateUser({
        nickname: formData.nickname,
        profileImage: formData.profileImage,
      });

      success('프로필이 수정되었습니다.');
      navigate('/mypage');
    } catch (err) {
      showError('프로필 수정에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 로그아웃
  const handleLogout = async () => {
    try {
      await logout();
      success('로그아웃 되었습니다.');
      navigate('/login');
    } catch (err) {
      showError('로그아웃에 실패했습니다.');
    }
  };

  // 회원탈퇴
  const handleWithdraw = async () => {
    try {
      // API 연동 필요: 회원탈퇴 API
      // await deleteAccount();
      
      await logout();
      success('회원탈퇴가 완료되었습니다.');
      navigate('/login');
    } catch (err) {
      showError('회원탈퇴에 실패했습니다.');
    }
  };

  return (
    <div className="mypage-edit">
      <Header 
        showBack 
        title="프로필 편집"
        rightElement={
          <Button 
            size="small" 
            onClick={handleSave}
            disabled={isSubmitting}
            loading={isSubmitting}
          >
            저장
          </Button>
        }
      />

      <div className="mypage-edit__content">
        {/* 프로필 이미지 */}
        <div className="mypage-edit__avatar-section">
          <div 
            className="mypage-edit__avatar"
            onClick={() => fileInputRef.current?.click()}
          >
            {formData.profileImage ? (
              <img src={formData.profileImage} alt="프로필" />
            ) : (
              <div className="mypage-edit__avatar-placeholder" />
            )}
            <div className="mypage-edit__avatar-overlay">
              <IoCamera size={24} />
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg"
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
          <button 
            className="mypage-edit__avatar-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            사진 변경
          </button>
        </div>

        {/* 닉네임 */}
        <div className="mypage-edit__field">
          <Input
            label="닉네임"
            value={formData.nickname}
            onChange={handleNicknameChange}
            placeholder="닉네임을 입력하세요"
            error={nicknameError}
            maxLength={16}
          />
        </div>

        {/* 구분선 */}
        <div className="mypage-edit__divider" />

        {/* 계정 관리 */}
        <div className="mypage-edit__account">
          <button 
            className="mypage-edit__account-btn"
            onClick={() => setShowLogoutModal(true)}
          >
            로그아웃
          </button>
          <button 
            className="mypage-edit__account-btn mypage-edit__account-btn--danger"
            onClick={() => setShowWithdrawModal(true)}
          >
            회원탈퇴
          </button>
        </div>
      </div>

      {/* 로그아웃 확인 모달 */}
      <AlertModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="로그아웃"
        message="정말 로그아웃 하시겠습니까?"
        confirmText="로그아웃"
        onConfirm={handleLogout}
      />

      {/* 회원탈퇴 확인 모달 */}
      <AlertModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        title="회원탈퇴"
        message="정말 탈퇴하시겠습니까? 모든 데이터가 삭제되며 복구할 수 없습니다."
        confirmText="탈퇴"
        onConfirm={handleWithdraw}
        danger
      />
    </div>
  );
};

export default MyPageEdit;
