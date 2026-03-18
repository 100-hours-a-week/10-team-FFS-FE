import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { AlertModal } from '../components/common';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  deleteAccount,
  getUserProfile,
  checkNickname,
  uploadFiles,
  updateNickname,
  updateProfileImage,
  deleteProfileImage,
} from '../api';
import { validateNickname, fileToDataUrl, isValidUploadImage } from '../utils/helpers';
import { IoCamera } from 'react-icons/io5';
import defaultProfile from '../assets/defalt.png';
import './MyPageEdit.css';

const MyPageEdit = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { success, error: showError } = useToast();
  const fileInputRef = useRef(null);
  const nicknameDebounceRef = useRef(null);

  const [profile, setProfile] = useState(null);

  // 이미지 pending 상태 (완료 버튼 전까지 스테이징)
  const [pendingImageFile, setPendingImageFile] = useState(null); // 새 이미지 파일
  const [profilePreview, setProfilePreview] = useState(null);    // 새 이미지 미리보기
  const [imageDeleted, setImageDeleted] = useState(false);       // 삭제 스테이징

  // 닉네임 상태
  const [nickname, setNickname] = useState('');
  const [originalNickname, setOriginalNickname] = useState('');
  const [nicknameStatus, setNicknameStatus] = useState({
    checking: false,
    available: null,
    message: '',
  });

  // 저장 중 상태
  const [isSaving, setIsSaving] = useState(false);

  // 모달 상태
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  // 프로필 불러오기
  useEffect(() => {
    if (!user?.id) return;
    getUserProfile(user.id)
      .then((res) => {
        const p = res.data?.userProfile;
        setProfile(p);
        setNickname(p?.nickname || '');
        setOriginalNickname(p?.nickname || '');
      })
      .catch(() => showError('프로필을 불러오는데 실패했습니다.'));
  }, [user?.id]);

  useEffect(() => {
    return () => {
      if (nicknameDebounceRef.current) clearTimeout(nicknameDebounceRef.current);
    };
  }, []);

  // 프로필 이미지 클릭
  const handleImageClick = () => fileInputRef.current?.click();

  // 이미지 선택 → 로컬 미리보기만 (업로드는 완료 버튼에서)
  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isValidUploadImage(file)) {
      showError('PNG, JPEG 파일만 업로드 가능합니다.');
      return;
    }

    try {
      const preview = await fileToDataUrl(file);
      setPendingImageFile(file);
      setProfilePreview(preview);
      setImageDeleted(false);
    } catch (err) {
      showError('이미지를 불러오는데 실패했습니다.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 사진 삭제 스테이징 (완료 버튼에서 실제 삭제)
  const handleDeleteImage = () => {
    setPendingImageFile(null);
    setProfilePreview(null);
    setImageDeleted(true);
  };

  // 닉네임 변경 + 유효성 검사
  const handleNicknameChange = (e) => {
    const value = e.target.value;
    setNickname(value);

    if (nicknameDebounceRef.current) clearTimeout(nicknameDebounceRef.current);

    if (!value || value === originalNickname) {
      setNicknameStatus({ checking: false, available: null, message: '' });
      return;
    }

    const validation = validateNickname(value);
    if (!validation.isValid) {
      setNicknameStatus({ checking: false, available: false, message: validation.errors[0] });
      return;
    }

    setNicknameStatus({ checking: true, available: null, message: '확인 중...' });

    nicknameDebounceRef.current = setTimeout(async () => {
      try {
        const res = await checkNickname(value);
        const { usable } = res.data;
        setNicknameStatus({
          checking: false,
          available: usable,
          message: usable ? '사용 가능한 닉네임입니다.' : '이미 사용 중인 닉네임입니다.',
        });
      } catch (err) {
        setNicknameStatus({ checking: false, available: false, message: '확인 중 오류가 발생했습니다.' });
      }
    }, 500);
  };

  // 완료 버튼 — 이미지 + 닉네임 일괄 저장
  const handleComplete = async () => {
    const isNicknameChanged = nickname !== originalNickname;

    // 닉네임 변경 시 유효성 확인
    if (isNicknameChanged) {
      if (nicknameStatus.checking) {
        showError('닉네임 확인 중입니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      if (!nicknameStatus.available) {
        showError(nicknameStatus.message || '사용할 수 없는 닉네임입니다.');
        return;
      }
    }

    const hasImageChange = pendingImageFile || imageDeleted;
    if (!hasImageChange && !isNicknameChanged) {
      navigate(-1);
      return;
    }

    setIsSaving(true);
    try {
      // 이미지 처리
      if (imageDeleted && profile?.userProfileImageUrl) {
        await deleteProfileImage();
      } else if (pendingImageFile) {
        const fileIds = await uploadFiles('PROFILE', [pendingImageFile]);
        await updateProfileImage(fileIds[0]);
      }

      // 닉네임 처리
      if (isNicknameChanged) {
        await updateNickname(nickname);
        setOriginalNickname(nickname);
      }

      success('프로필이 저장되었습니다.');
      navigate(-1);
    } catch (err) {
      showError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  // 로그아웃
  const handleLogout = async () => {
    try {
      await logout();
      success('로그아웃 되었습니다.');
      navigate('/feed');
    } catch (err) {
      showError('로그아웃에 실패했습니다.');
    }
  };

  // 회원탈퇴
  const handleWithdraw = async () => {
    try {
      await deleteAccount();
      success('회원탈퇴가 완료되었습니다.');
      navigate('/feed');
    } catch (err) {
      showError('회원탈퇴에 실패했습니다.');
    }
  };

  // 표시할 이미지 결정
  const displayImage = imageDeleted
    ? defaultProfile
    : profilePreview || profile?.userProfileImageUrl || defaultProfile;

  // "사진 삭제" 버튼 표시 조건: 기본 이미지가 아닌 사진이 있을 때
  const hasCustomImage = !imageDeleted && (pendingImageFile || profile?.userProfileImageUrl);

  return (
    <div className="mypage-edit">
      <Header showBack title="계정 관리" />

      <div className="mypage-edit__content">
        {/* 프로필 이미지 섹션 */}
        <div className="mypage-edit__profile-section">
          <div
            className="mypage-edit__avatar-wrapper"
            onClick={handleImageClick}
          >
            <img src={displayImage} alt="프로필" className="mypage-edit__avatar-img" />
            <div className="mypage-edit__avatar-overlay">
              <IoCamera size={18} />
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            style={{ display: 'none' }}
            onChange={handleImageSelect}
          />
          {hasCustomImage && (
            <button
              className="mypage-edit__delete-image-btn"
              onClick={handleDeleteImage}
            >
              사진 삭제
            </button>
          )}
        </div>

        {/* 닉네임 섹션 */}
        <div className="mypage-edit__nickname-section">
          <label className="mypage-edit__label">닉네임</label>
          <input
            type="text"
            className="mypage-edit__nickname-input"
            value={nickname}
            onChange={handleNicknameChange}
            placeholder="닉네임을 입력해주세요"
            maxLength={15}
          />
          {nicknameStatus.message && (
            <p
              className={`mypage-edit__nickname-status${
                nicknameStatus.available === false
                  ? ' mypage-edit__nickname-status--error'
                  : nicknameStatus.available
                  ? ' mypage-edit__nickname-status--success'
                  : ''
              }`}
            >
              {nicknameStatus.message}
            </p>
          )}
        </div>

        <div className="mypage-edit__divider" />

        {/* 계정 관리 버튼 */}
        <div className="mypage-edit__account">
          <a
            href="https://forms.gle/tPzq11k13oncrwwMA"
            target="_blank"
            rel="noopener noreferrer"
            className="mypage-edit__account-btn"
          >
            서비스 피드백 보내기
          </a>
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
        {/* 완료 버튼 */}
        <button
          className="mypage-edit__complete-btn"
          onClick={handleComplete}
          disabled={isSaving}
        >
          {isSaving ? '저장 중...' : '저장하기'}
        </button>
      </div>

      <AlertModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="로그아웃"
        message="정말 로그아웃 하시겠습니까?"
        confirmText="로그아웃"
        onConfirm={handleLogout}
      />
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
