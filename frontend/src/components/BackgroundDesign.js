import React from 'react';
import { useLocation } from 'react-router-dom';

const bgImage = (name) => ({ '--bg-dark': `url(${process.env.PUBLIC_URL}/${name}.webp)` });

const BackgroundDesign = () => {
  const location = useLocation();
  const path = location.pathname;

  if (path === '/login' || path === '/register') {
    return (
      <div className="luxury-bg auth-bg">
        <div
          className="auth-bg-image"
          style={bgImage('auth-bg')}
        ></div>
        <div className="auth-bg-overlay"></div>
      </div>
    );
  }

  if (path === '/profile') {
    return (
      <div className="luxury-bg profile-bg">
        <div
          className="profile-bg-image"
          style={bgImage('profile-bg')}
        ></div>
        <div className="profile-bg-overlay"></div>
      </div>
    );
  }

  if (path.startsWith('/yatra/')) {
    return (
      <div className="luxury-bg yatra-bg">
        <div
          className="yatra-bg-image"
          style={bgImage('profile-bg')}
        ></div>
        <div className="yatra-bg-overlay"></div>
      </div>
    );
  }

  if (path === '/ledger' || path === '/yatra-management' || path === '/previous-yatras') {
    return (
      <div className="luxury-bg dashboard-bg">
        <div
          className="dash-bg-image"
          style={bgImage('dash-bg')}
        ></div>
        <div className="dash-bg-overlay"></div>
      </div>
    );
  }

  // Default for dashboard (/)
  return (
    <div className="luxury-bg dashboard-bg">
      <div
        className="dash-bg-image"
        style={bgImage('dash-bg')}
      ></div>
      <div className="dash-bg-overlay"></div>
    </div>
  );
};

export default BackgroundDesign;
