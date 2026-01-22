import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IoChevronBack } from 'react-icons/io5';
import { HiOutlineDotsHorizontal } from 'react-icons/hi';
import './Header.css';

const Header = ({
  title,
  showBack = false,
  onBack,
  rightElement,
  rightAction,
  rightIcon,
  transparent = false,
  className = '',
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header className={`header ${transparent ? 'header--transparent' : ''} ${className}`}>
      <div className="header__left">
        {showBack && (
          <button className="header__back" onClick={handleBack}>
            <IoChevronBack size={24} />
          </button>
        )}
      </div>
      
      <div className="header__center">
        {title && <h1 className="header__title">{title}</h1>}
      </div>
      
      <div className="header__right">
        {rightElement}
        {rightAction && (
          <button className="header__action" onClick={rightAction}>
            {rightIcon || <HiOutlineDotsHorizontal size={24} />}
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
