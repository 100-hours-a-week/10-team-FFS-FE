import React from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../../contexts/ToastContext';
import './Toast.css';

const Toast = () => {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="toast-container">
      {toasts.map((toast) => (
        <div 
          key={toast.id} 
          className={`toast toast--${toast.type}`}
        >
          <span className="toast__message">{toast.message}</span>
        </div>
      ))}
    </div>,
    document.body
  );
};

export default Toast;
