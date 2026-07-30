import React from 'react';

const Button = ({ children, onClick, type = 'button', variant = 'primary', style, ...props }) => {
  const baseClass = 'btn';
  const variantClass = variant ? `btn-${variant}` : 'btn-default';
  
  return (
    <button
      type={type}
      onClick={onClick}
      className={`${baseClass} ${variantClass}`}
      style={{ width: '100%', ...style, opacity: props.disabled ? 0.6 : 1, cursor: props.disabled ? 'not-allowed' : 'pointer' }}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
