import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout';
import { AlertModal } from '../components/common';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { deleteAccount } from '../api';
import './MyPageEdit.css';

/**
 * V1 계정 관리 페이지
 * - 로그아웃
 * - 회원탈퇴
 */
const MyPageEdit = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { success, error: showError } = useToast();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

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
      await deleteAccount();
      success('회원탈퇴가 완료되었습니다.');
      navigate('/login');
    } catch (err) {
      console.error('회원탈퇴 실패:', err);
      showError('회원탈퇴에 실패했습니다.');
    }
  };

  return (
    <div className="mypage-edit">
      <Header showBack title="계정 관리" />

      <div className="mypage-edit__content">
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