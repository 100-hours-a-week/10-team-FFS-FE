import React from 'react';
import './Loading.css';

// 스피너 로딩
export const Spinner = ({ size = 'medium', className = '' }) => {
  return (
    <div className={`spinner spinner--${size} ${className}`}>
      <div className="spinner__circle" />
    </div>
  );
};

// 전체 화면 로딩
export const FullPageLoading = ({ message = '로딩 중...' }) => {
  return (
    <div className="loading-fullpage">
      <Spinner size="large" />
      {message && <p className="loading-fullpage__message">{message}</p>}
    </div>
  );
};

// 인라인 로딩 (리스트 하단 등)
export const InlineLoading = () => {
  return (
    <div className="loading-inline">
      <Spinner size="small" />
    </div>
  );
};

// 스켈레톤 로딩 - 이미지용
export const ImageSkeleton = ({ aspectRatio = '1/1', className = '' }) => {
  return (
    <div 
      className={`skeleton-image ${className}`}
      style={{ aspectRatio }}
    />
  );
};

// 스켈레톤 로딩 - 텍스트용
export const TextSkeleton = ({ width = '100%', height = '16px', className = '' }) => {
  return (
    <div 
      className={`skeleton-text ${className}`}
      style={{ width, height }}
    />
  );
};

// 스켈레톤 로딩 - 원형 (프로필 이미지 등)
export const CircleSkeleton = ({ size = 40, className = '' }) => {
  return (
    <div 
      className={`skeleton-circle ${className}`}
      style={{ width: size, height: size }}
    />
  );
};

// 피드 카드 스켈레톤
export const FeedCardSkeleton = () => {
  return (
    <div className="skeleton-feed-card">
      <ImageSkeleton aspectRatio="3/4" />
      <div className="skeleton-feed-card__info">
        <div className="skeleton-feed-card__header">
          <CircleSkeleton size={24} />
          <TextSkeleton width="80px" height="14px" />
        </div>
        <div className="skeleton-feed-card__stats">
          <TextSkeleton width="40px" height="12px" />
          <TextSkeleton width="40px" height="12px" />
        </div>
      </div>
    </div>
  );
};

// 옷 카드 스켈레톤
export const ClothesCardSkeleton = () => {
  return (
    <div className="skeleton-clothes-card">
      <ImageSkeleton aspectRatio="1/1" />
    </div>
  );
};

export default Spinner;
