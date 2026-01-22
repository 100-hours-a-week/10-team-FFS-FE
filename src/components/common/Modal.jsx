import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

// iOS 스타일 Alert Modal
export const AlertModal = ({
  isOpen,
  onClose,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  onConfirm,
  showCancel = true,
  danger = false,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-alert" onClick={(e) => e.stopPropagation()}>
        <div className="modal-alert__content">
          {title && <h3 className="modal-alert__title">{title}</h3>}
          {message && <p className="modal-alert__message">{message}</p>}
        </div>
        <div className="modal-alert__actions">
          {showCancel && (
            <button 
              className="modal-alert__button modal-alert__button--cancel"
              onClick={onClose}
            >
              {cancelText}
            </button>
          )}
          <button 
            className={`modal-alert__button modal-alert__button--confirm ${danger ? 'modal-alert__button--danger' : ''}`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// iOS 스타일 Action Sheet (하단에서 올라오는 모달)
export const ActionSheet = ({
  isOpen,
  onClose,
  title,
  actions = [], // [{ label, onClick, danger }]
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay modal-overlay--bottom" onClick={onClose}>
      <div className="action-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="action-sheet__content">
          {title && <div className="action-sheet__title">{title}</div>}
          {actions.map((action, index) => (
            <button
              key={index}
              className={`action-sheet__item ${action.danger ? 'action-sheet__item--danger' : ''}`}
              onClick={() => {
                action.onClick?.();
                onClose();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
        <button className="action-sheet__cancel" onClick={onClose}>
          취소
        </button>
      </div>
    </div>,
    document.body
  );
};

// 일반 모달 (커스텀 컨텐츠용)
export const Modal = ({
  isOpen,
  onClose,
  children,
  title,
  showCloseButton = true,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {(title || showCloseButton) && (
          <div className="modal__header">
            {title && <h3 className="modal__title">{title}</h3>}
            {showCloseButton && (
              <button className="modal__close" onClick={onClose}>
                ✕
              </button>
            )}
          </div>
        )}
        <div className="modal__body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

// 풀스크린 모달
export const FullScreenModal = ({
  isOpen,
  onClose,
  children,
  title,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-fullscreen">
      <div className="modal-fullscreen__header">
        <button className="modal-fullscreen__back" onClick={onClose}>
          ✕
        </button>
        {title && <h3 className="modal-fullscreen__title">{title}</h3>}
        <div className="modal-fullscreen__spacer" />
      </div>
      <div className="modal-fullscreen__body">
        {children}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
