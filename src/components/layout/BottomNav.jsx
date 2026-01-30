import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IoSearch, IoHome, IoPersonOutline } from 'react-icons/io5';
import { BsGrid3X3 } from 'react-icons/bs';
import { MdOutlineAddBox } from 'react-icons/md';
import './BottomNav.css';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const getUserId = () => localStorage.getItem('userId');

  const navItems = [
    {
      id: 'ai-coordi',
      icon: IoSearch,
      label: '검색',
      path: '/ai-coordi',
    },
    {
      id: 'closet',
      icon: BsGrid3X3,
      label: '옷장',
      path: `/closet/${getUserId()}`,
    },
    {
      id: 'feed',
      icon: IoHome,
      label: '홈',
      path: '/feed',
    },
    {
      id: 'feed-create',
      icon: MdOutlineAddBox,
      label: '피드 업로드',
      path: '/feed/create',
    },
    {
      id: 'mypage',
      icon: IoPersonOutline,
      label: '마이페이지',
      path: `/profile/${getUserId()}`,
    },
  ];

  const isActive = (path) => {
    if (path === '/feed') {
      return location.pathname === '/feed' || location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path);
        
        return (
          <button
            key={item.id}
            className={`bottom-nav__item ${active ? 'bottom-nav__item--active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <Icon className="bottom-nav__icon" size={24} />
            <span className="bottom-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
