import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { AppLayout } from './components/layout';
import {
  LoginPage,
  KakaoCallbackPage,
  AdditionalInfoPage,
  ClosetListPage,
  ClosetDetailPage,
  ClosetUploadPage,
  AICoordPage,
  FeedListPage,
  FeedDetailPage,
  FeedCreatePage,
  ProfilePage,
  OtherClosetListPage,
  OtherClosetDetailPage,
  MyPageEdit,
} from './pages';
import { FullPageLoading } from './components/common';
import './styles/global.css';

// 인증이 필요한 라우트를 보호하는 컴포넌트
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullPageLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// 로그인된 사용자가 접근하면 리다이렉트하는 컴포넌트
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullPageLoading />;
  }

  if (isAuthenticated) {
    return <Navigate to="/closet" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* 공개 라우트 */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/additional-info"
        element={
          <PublicRoute>
            <AdditionalInfoPage />
          </PublicRoute>
        }
      />
      {/* 카카오 OAuth 콜백 */}
      <Route path="/oauth/kakao/callback" element={<KakaoCallbackPage />} />

      {/* 보호된 라우트 - 레이아웃 포함 */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* 기본 경로 리다이렉트 */}
        <Route index element={<Navigate to="/closet" replace />} />
        
        {/* 옷장 */}
        <Route path="/closet" element={<ClosetListPage />} />
        <Route path="/closet/upload" element={<ClosetUploadPage />} />
        <Route path="/closet/:clothesId" element={<ClosetDetailPage />} />

        {/* AI 코디 */}
        <Route path="/ai-coordi" element={<AICoordPage />} />

        {/* 피드 */}
        <Route path="/feed" element={<FeedListPage />} />
        <Route path="/feed/create" element={<FeedCreatePage />} />
        <Route path="/feed/:feedId" element={<FeedDetailPage />} />
        <Route path="/feed/:feedId/edit" element={<FeedCreatePage />} />

        {/* 프로필 */}
        <Route path="/profile/:userId" element={<ProfilePage />} />
        <Route path="/profile/:userId/closet" element={<OtherClosetListPage />} />
        <Route path="/profile/:userId/closet/:clothesId" element={<OtherClosetDetailPage />} />

        {/* 프로필 편집 */}
        <Route path="/mypage/edit" element={<MyPageEdit />} />
      </Route>

      {/* 404 - 존재하지 않는 경로 */}
      <Route path="*" element={<Navigate to="/closet" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
