import React, { useState, useEffect } from 'react';
import { IoArrowUp } from 'react-icons/io5';
import './ScrollToTopButton.css';

const ScrollToTopButton = ({ scrollThreshold = 200, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setIsVisible(scrollTop > scrollThreshold);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [scrollThreshold]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <button
      className={`scroll-to-top-button ${className}`}
      onClick={scrollToTop}
      aria-label="맨 위로 이동"
    >
      <IoArrowUp size={20} />
    </button>
  );
};

export default ScrollToTopButton;
