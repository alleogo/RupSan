import React from 'react';

const Card = ({ children, style }) => {
  return (
    <div className="glass-card" style={{ padding: '24px', ...style }}>
      {children}
    </div>
  );
};

export default Card;