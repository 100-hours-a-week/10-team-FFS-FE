import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RiKakaoTalkFill } from 'react-icons/ri';
import logo from '../assets/logo.png';
import './LoginPage.css';

// 카카오 로그인 설정
const KAKAO_CLIENT_ID = process.env.REACT_APP_KAKAO_CLIENT_ID;
const KAKAO_REDIRECT_URI = process.env.REACT_APP_KAKAO_REDIRECT_URI || 'http://localhost:3000/oauth/kakao/callback';

const LoginPage = () => {
  const navigate = useNavigate();

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
          <div className="login-page__logo">
            <img src={logo} alt="KlosetLab" className="login-page__logo-img" />
          </div>
          <h1 className="login-page__title">KlosetLab</h1>
          <p className="login-page__subtitle">AI 기반 옷장 관리 & 패션 커뮤니티</p>
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
          <button
            className="login-page__guest-button"
            onClick={() => navigate('/feed')}
          >
            로그인 없이 둘러보기
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
