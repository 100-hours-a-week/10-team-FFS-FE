import React from 'react';
import { RiKakaoTalkFill } from 'react-icons/ri';
import './LoginPage.css';

// 카카오 로그인 설정
const KAKAO_CLIENT_ID = process.env.REACT_APP_KAKAO_CLIENT_ID;
const KAKAO_REDIRECT_URI = process.env.REACT_APP_KAKAO_REDIRECT_URI;

const LoginPage = () => {
  // 카카오 로그인 페이지로 리다이렉트
  const handleKakaoLogin = () => {
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}&response_type=code`;
    window.location.href = kakaoAuthUrl;
  };

  return (
    <div className="login-page">
      <div className="login-page__content">
        {/* 로고 영역 */}
        <div className="login-page__logo-area">
          {/* 
          <div className="login-page__logo">
            <div className="login-page__logo-circle" />
          </div>
          */}
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
