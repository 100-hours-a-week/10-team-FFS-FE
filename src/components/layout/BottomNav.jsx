import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IoSearch, IoHome, IoPersonOutline } from 'react-icons/io5';
import { BsGrid3X3 } from 'react-icons/bs';
import { MdOutlineAddBox } from 'react-icons/md';
import { useAuth } from '../../contexts/AuthContext';
import { LoginPromptModal } from '../common';
import './BottomNav.css';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const getUserId = () => localStorage.getItem('userId');

  const navItems = [
    {
      id: 'ai-coordi',
      icon: IoSearch,
      label: '검색',
      path: '/ai-coordi',
      requireAuth: true,
    },
    {
      id: 'closet',
      icon: BsGrid3X3,
      label: '옷장',
      path: `/closet/${getUserId()}`,
      requireAuth: true,
    },
    {
      id: 'feed',
      icon: IoHome,
      label: '홈',
      path: '/feed',
      requireAuth: false,
    },
    {
      id: 'feed-create',
      icon: MdOutlineAddBox,
      label: '피드 업로드',
      path: '/feed/create',
      requireAuth: true,
    },
    {
      id: 'mypage',
      icon: IoPersonOutline,
      label: '마이페이지',
      path: `/profile/${getUserId()}`,
      requireAuth: true,
    },
  ];

  const isActive = (path) => {
    if (path === '/feed') {
      return location.pathname === '/feed' || location.pathname === '/';
    }
    if (path === '/ai-coordi') {
      return location.pathname === '/ai-coordi' || location.pathname === '/ai-shop';
    }
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (item) => {
    if (item.requireAuth && !isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    navigate(item.path);
  };

  return (
    <>
      <nav className="bottom-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <button
              key={item.id}
              className={`bottom-nav__item ${active ? 'bottom-nav__item--active' : ''}`}
              onClick={() => handleNavClick(item)}
            >
              <Icon className="bottom-nav__icon" size={24} />
              <span className="bottom-nav__label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <LoginPromptModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        message="로그인 후 이용할 수 있는 기능입니다."
      />
    </>
  );
};

export default BottomNav;