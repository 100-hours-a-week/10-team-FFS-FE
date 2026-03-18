import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ChatProvider } from './contexts/ChatContext';
import { AppLayout } from './components/layout';
import {
  LoginPage,
  KakaoCallbackPage,
  AdditionalInfoPage,
  ClosetListPage,
  ClosetDetailPage,
  ClosetUploadPage,
  ClothesUploadPage,
  ClothesEditPage,
  AICoordPage,
  FeedListPage,
  FeedDetailPage,
  FeedCreatePage,
  ProfilePage,
  OtherClosetListPage,
  OtherClosetDetailPage,
  MyPageEdit,
  DmListPage,
  DmChatPage,
  AIShopPage,
  OutfitChatPage,
  UserSearchPage,
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
    return <Navigate to="/feed" replace />;
  }

  return children;
};

// 인증 로딩 완료까지 대기하는 래퍼 (비회원도 접근 가능)
const WaitForAuth = ({ children }) => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <FullPageLoading />;
  }

  return children;
};

// 루트 경로: 인증 여부에 따라 피드 또는 로그인으로 이동
const RootRedirect = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullPageLoading />;
  }

  return <Navigate to="/feed" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      {/* 공개 라우트 (로그인/회원가입) */}
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

      {/* 비회원도 접근 가능한 라우트 (피드 목록/상세, 프로필) */}
      <Route
        element={
          <WaitForAuth>
            <AppLayout />
          </WaitForAuth>
        }
      >
        {/* 기본 경로 → 인증 여부에 따라 분기 */}
        <Route index element={<RootRedirect />} />

        {/* 피드 (읽기) */}
        <Route path="/feed" element={<FeedListPage />} />
        <Route path="/feed/:feedId" element={<FeedDetailPage />} />

        {/* 유저 검색 */}
        <Route path="/search" element={<UserSearchPage />} />

        {/* 프로필 (읽기) */}
        <Route path="/profile/:userId" element={<ProfilePage />} />

        {/* 타인 옷장 / 옷 상세 (비회원도 접근 가능) */}
        <Route path="/closet/:userId" element={<ClosetListPage />} />
        <Route path="/clothes/:clothesId" element={<ClosetDetailPage />} />
        <Route path="/profile/:userId/closet" element={<OtherClosetListPage />} />
        <Route path="/profile/:userId/closet/:clothesId" element={<OtherClosetDetailPage />} />
      </Route>

      {/* 보호된 라우트 - 로그인 필수 */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* 옷장 (로그인 필요) */}
        <Route path="/closet/upload" element={<ClothesUploadPage />} />
        <Route path="/clothes/:clothesId/edit" element={<ClothesEditPage />} />

        {/* AI 코디 */}
        <Route path="/ai-coordi" element={<AICoordPage />} />

        {/* AI 쇼핑 추천 */}
        <Route path="/ai-shop" element={<AIShopPage />} />

        {/* 피드 (쓰기) */}
        <Route path="/feed/create" element={<FeedCreatePage />} />
        <Route path="/feed/:feedId/edit" element={<FeedCreatePage />} />

        {/* 프로필 편집 */}
        <Route path="/mypage/edit" element={<MyPageEdit />} />

        {/* DM 채팅 */}
        <Route path="/dm" element={<DmListPage />} />
        <Route path="/dm/:roomId" element={<DmChatPage />} />

        <Route path="/test" element={<ClosetUploadPage />} />
      </Route>

      {/* 보호 라우트 — BottomNav 없음 */}
      <Route
        element={
          <ProtectedRoute>
            <Outlet />
          </ProtectedRoute>
        }
      >
        <Route path="/ai-coordi/:sessionId" element={<OutfitChatPage />} />
      </Route>

      {/* 404 - 존재하지 않는 경로 */}
      <Route path="*" element={<Navigate to="/feed" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ChatProvider>
            <AppRoutes />
          </ChatProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;