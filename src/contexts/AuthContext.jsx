import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAccessToken, setAccessToken, removeAccessToken, removeUserId, getUserId, logout as logoutAPI } from '../api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 초기 인증 상태 확인
  useEffect(() => {
    const initAuth = async () => {
      const token = getAccessToken();
      const userId = getUserId();

      if (token && userId) {
        // localStorage에 저장된 userId로 user 객체 설정
        setUser({ id: Number(userId) });
        setIsAuthenticated(true);
      } else if (token) {
        // userId가 없으면 토큰도 무효화 (비정상 상태)
        removeAccessToken();
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  // 로그인
  const login = useCallback(async (accessToken, userData) => {
    setAccessToken(accessToken);

    if (userData?.id) {
      setUser({ id: Number(userData.id) });
      setIsAuthenticated(true);
      return userData;
    }

    // userData가 없으면 로그인 실패 처리
    throw new Error('User data is required for login');
  }, []);

  // 로그아웃
  const logout = useCallback(async () => {
    try {
      await logoutAPI();
    } catch (err) {
      console.error('로그아웃 API 호출 실패:', err);
    } finally {
      // API 실패해도 클라이언트 상태는 정리
      removeAccessToken();
      removeUserId();
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  // 사용자 정보 업데이트
  const updateUser = useCallback((updates) => {
    setUser(prev => ({ ...prev, ...updates }));
  }, []);

  // 신규 사용자 여부 확인
  const isNewUser = user?.isNewUser ?? false;

  const value = {
    user,
    isLoading,
    isAuthenticated,
    isNewUser,
    login,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
