import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { RiKakaoTalkFill } from 'react-icons/ri';
import './LoginPage.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { success } = useToast();

  // API 연동 필요: 실제 카카오 로그인 연동
  const handleKakaoLogin = async () => {
    try {
      // 카카오 로그인 URL로 리다이렉트
      // window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code`;
      
      // 목업: 로그인 성공 시뮬레이션
      const mockToken = 'mock_access_token_' + Date.now();
      const mockUser = {
        id: 'user_001',
        nickname: 'sample_nickname',
        profileImage: null,
        isNewUser: false, // true면 추가정보 입력 페이지로
      };
      
      await login(mockToken, mockUser);
      
      if (mockUser.isNewUser) {
        navigate('/additional-info');
      } else {
        success('로그인 되었습니다');
        navigate('/closet');
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__content">
        {/* 로고 영역 */}
        <div className="login-page__logo-area">
          <div className="login-page__logo">
            <div className="login-page__logo-circle" />
          </div>
          <h1 className="login-page__title">KlosetLab</h1>
        </div>

        {/* 로그인 버튼 영역 */}
        <div className="login-page__button-area">
          <button 
            className="login-page__kakao-button"
            onClick={handleKakaoLogin}
          >
            <RiKakaoTalkFill size={24} />
            <span>카카오톡으로 로그인 하기</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
