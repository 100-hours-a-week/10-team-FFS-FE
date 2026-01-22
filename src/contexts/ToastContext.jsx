import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  // 토스트 추가
  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    
    setToasts(prev => [...prev, { id, message, type }]);

    // 자동 제거
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, duration);

    return id;
  }, []);

  // 성공 토스트
  const success = useCallback((message, duration) => {
    return showToast(message, 'success', duration);
  }, [showToast]);

  // 에러 토스트
  const error = useCallback((message, duration) => {
    return showToast(message, 'error', duration);
  }, [showToast]);

  // 정보 토스트
  const info = useCallback((message, duration) => {
    return showToast(message, 'info', duration);
  }, [showToast]);

  // 경고 토스트
  const warning = useCallback((message, duration) => {
    return showToast(message, 'warning', duration);
  }, [showToast]);

  // 토스트 수동 제거
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const value = {
    toasts,
    showToast,
    success,
    error,
    info,
    warning,
    removeToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
};

export default ToastContext;
