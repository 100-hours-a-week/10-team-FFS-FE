import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { kakaoLogin, setUserId } from '../api';
import { FullPageLoading } from '../components/common';
import './KakaoCallbackPage.css';

const KakaoCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const { success, error: showError } = useToast();
  const [errorMessage, setErrorMessage] = useState(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    const processKakaoLogin = async () => {
      // React StrictMode 중복 실행 방지
      if (isProcessingRef.current) {
        return;
      }
      isProcessingRef.current = true;

      const authorizationCode = searchParams.get('code');
      const errorParam = searchParams.get('error');

      // 카카오 로그인 에러 처리
      if (errorParam) {
        const errorDescription = searchParams.get('error_description') || '카카오 로그인에 실패했습니다.';
        setErrorMessage(errorDescription);
        showError(errorDescription);
        return;
      }

      // 인가 코드가 없는 경우
      if (!authorizationCode) {
        setErrorMessage('인가 코드가 없습니다.');
        showError('로그인 처리 중 오류가 발생했습니다.');
        return;
      }

      try {
        // 백엔드에 인가 코드 전송
        const response = await kakaoLogin(authorizationCode);
        const { isRegistered, accessToken, userId } = response.data;

        if (isRegistered) {
          // 기존 회원: 로그인 처리 후 옷장 페이지로 이동
          setUserId(userId);
          await login(accessToken, { id: userId });
          success('로그인 되었습니다');
          navigate('/closet', { replace: true });
        } else {
          // 신규 회원: 임시 토큰 저장 후 추가 정보 입력 페이지로 이동
          localStorage.setItem('accessToken', accessToken);
          navigate('/additional-info', { replace: true });
        }
      } catch (err) {
        console.error('카카오 로그인 처리 실패:', err);
        setErrorMessage(err.message || '로그인 처리 중 오류가 발생했습니다.');
        showError(err.message || '로그인 처리 중 오류가 발생했습니다.');
      }
    };

    processKakaoLogin();
  }, [searchParams, login, navigate, success, showError]);

  // 에러 발생 시 에러 화면 표시
  if (errorMessage) {
    return (
      <div className="kakao-callback">
        <div className="kakao-callback__error">
          <p className="kakao-callback__error-message">{errorMessage}</p>
          <button
            className="kakao-callback__retry-button"
            onClick={() => navigate('/login', { replace: true })}
          >
            로그인 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 로딩 중
  return <FullPageLoading />;
};

export default KakaoCallbackPage;
