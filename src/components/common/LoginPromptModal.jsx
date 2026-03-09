import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertModal } from './Modal';

const LoginPromptModal = ({ isOpen, onClose, message = '로그인이 필요한 기능입니다.' }) => {
  const navigate = useNavigate();

  const handleConfirm = () => {
    onClose();
    navigate('/login');
  };

  return (
    <AlertModal
      isOpen={isOpen}
      onClose={onClose}
      title="로그인 필요"
      message={message}
      confirmText="로그인"
      cancelText="취소"
      onConfirm={handleConfirm}
      showCancel
    />
  );
};

export default LoginPromptModal;