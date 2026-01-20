import React, { forwardRef } from 'react';
import './Input.css';

const Input = forwardRef(({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  onFocus,
  error,
  helperText,
  disabled = false,
  required = false,
  maxLength,
  className = '',
  inputClassName = '',
  ...props
}, ref) => {
  const classNames = [
    'input-wrapper',
    error && 'input-wrapper--error',
    disabled && 'input-wrapper--disabled',
    className,
  ].filter(Boolean).join(' ');

  const inputClassNames = [
    'input',
    inputClassName,
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      {label && (
        <label className="input__label">
          {required && <span className="input__required">*</span>}
          {label}
        </label>
      )}
      <input
        ref={ref}
        type={type}
        className={inputClassNames}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        disabled={disabled}
        maxLength={maxLength}
        {...props}
      />
      {(error || helperText) && (
        <p className={`input__helper ${error ? 'input__helper--error' : ''}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
