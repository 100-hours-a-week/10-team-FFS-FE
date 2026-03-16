import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import Toast from '../common/Toast';
import transparentLogo from '../../assets/transparent_logo.png';
import './AppLayout.css';

// 하단 네비게이션을 숨길 페이지 목록
const HIDE_NAV_PATHS = ['/login', '/additional-info'];

const AppLayout = () => {
  const location = useLocation();
  const hideNav = HIDE_NAV_PATHS.some(path => location.pathname.startsWith(path));

  return (
    <div className="app-layout">
      {/* 왼쪽 사이드바 - 데스크탑 전용 */}
      <aside className="app-layout__sidebar" aria-hidden="true">
        <div className="app-layout__sidebar-inner">
          <img src={transparentLogo} alt="" className="app-layout__sidebar-logo" />
          <span className="app-layout__sidebar-brand">KlosetLab</span>
          <p className="app-layout__sidebar-tagline">
            AI 기반 옷장 관리 & 패션 커뮤니티
          </p>
        </div>
      </aside>

      <div className="app-layout__container">
        <img
          src={transparentLogo}
          alt=""
          className="app-layout__watermark"
          aria-hidden="true"
        />
        <main className={`app-layout__main ${hideNav ? '' : 'app-layout__main--with-nav'}`}>
          <Outlet />
        </main>
        {!hideNav && <BottomNav />}
      </div>
      <Toast />
    </div>
  );
};

export default AppLayout;
