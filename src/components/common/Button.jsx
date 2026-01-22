import React from 'react';
import './Button.css';

const Button = ({
  children,
  variant = 'primary', // primary, secondary, outline, ghost, danger
  size = 'medium', // small, medium, large
  fullWidth = false,
  disabled = false,
  loading = false,
  type = 'button',
  onClick,
  className = '',
  ...props
}) => {
  const classNames = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth && 'btn--full',
    disabled && 'btn--disabled',
    loading && 'btn--loading',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classNames}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <span className="btn__spinner" />}
      <span className={loading ? 'btn__content--hidden' : 'btn__content'}>
        {children}
      </span>
    </button>
  );
};

export default Button;
