import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import Toast from '../common/Toast';
import './AppLayout.css';

// 하단 네비게이션을 숨길 페이지 목록
const HIDE_NAV_PATHS = ['/login', '/additional-info'];

const AppLayout = () => {
  const location = useLocation();
  const hideNav = HIDE_NAV_PATHS.some(path => location.pathname.startsWith(path));

  return (
    <div className="app-layout">
      <div className="app-layout__container">
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
