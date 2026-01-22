import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { mockCurrentUser } from '../mocks/data';
import { getAccessToken, setAccessToken, removeAccessToken } from '../api';

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
      
      if (token) {
        // API 연동 필요: 실제 사용자 정보 조회
        // const userData = await getCurrentUser();
        // setUser(userData);
        
        // 목업 데이터 사용
        setUser(mockCurrentUser);
        setIsAuthenticated(true);
      }
      
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // 로그인
  const login = useCallback(async (accessToken, userData = null) => {
    setAccessToken(accessToken);
    
    // API 연동 필요: 실제 사용자 정보로 대체
    const userInfo = userData || mockCurrentUser;
    setUser(userInfo);
    setIsAuthenticated(true);
    
    return userInfo;
  }, []);

  // 로그아웃
  const logout = useCallback(async () => {
    // API 연동 필요: 서버 로그아웃 API 호출
    // await logoutAPI();
    
    removeAccessToken();
    setUser(null);
    setIsAuthenticated(false);
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
