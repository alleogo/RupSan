import React, { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

// Light mode: 12 parchment pictures with the feathers in different places (edges, corners, pairs),
// each with a tall version for phones. Every page gets its own placement for each type of user,
// and the same page looks different for each type of user. CSS picks one picture, so only that one downloads.
const FEATHER_SPOTS = 12;
// Where to anchor each picture when the screen crops it, so the feathers stay in view
const FEATHER_POS = ['right center', 'left center', 'left bottom', 'right bottom', 'right top', 'right center',
  'center', 'center', 'center', 'center bottom', 'center', 'center'];
const PAGES = ['/', '/yatra', '/profile', '/previous-yatras', '/yatra-management', '/ledger', '/users', '/centres', '/all-yatras'];
const ROLE_OFFSET = { Participant: 2, Manager: 5, Admin: 8, SuperAdmin: 11 };

const featherSpot = (path, role) => {
  if (path === '/login') return 0;
  if (path === '/register') return 1;
  const page = Math.max(0, PAGES.indexOf(path.startsWith('/yatra/') ? '/yatra' : path));
  return (page + (ROLE_OFFSET[role] ?? 0)) % FEATHER_SPOTS;
};

const bgStyle = (darkName, path, role) => {
  const spot = featherSpot(path, role);
  const base = `${process.env.PUBLIC_URL}/feathers/light-${spot}`;
  return {
    '--bg-dark': `url(${process.env.PUBLIC_URL}/${darkName}.webp)`,
    '--bg-light': `url(${base}.webp)`,
    '--bg-light-tall': `url(${base}-tall.webp)`,
    '--bg-light-pos': FEATHER_POS[spot]
  };
};

const BackgroundDesign = () => {
  const location = useLocation();
  const path = location.pathname;
  const { user } = useContext(AuthContext);
  const bgImage = (darkName) => bgStyle(darkName, path, user?.role);

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
