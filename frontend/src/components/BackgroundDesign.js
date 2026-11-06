import React, { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

// 12 pictures with the feathers in different places (edges, corners, pairs), on black leather for dark
// mode and parchment for light mode, each with a tall version for phones. Every page gets its own
// placement for each type of user, and the same page looks different for each type of user.
// CSS picks one picture, so only that one downloads.
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

const bgStyle = (path, role) => {
  const spot = featherSpot(path, role);
  const base = `${process.env.PUBLIC_URL}/feathers`;
  return {
    '--bg-dark': `url(${base}/dark-${spot}.webp)`,
    '--bg-dark-tall': `url(${base}/dark-${spot}-tall.webp)`,
    '--bg-light': `url(${base}/light-${spot}.webp)`,
    '--bg-light-tall': `url(${base}/light-${spot}-tall.webp)`,
    '--bg-pos': FEATHER_POS[spot]
  };
};

const BackgroundDesign = () => {
  const { pathname } = useLocation();
  const { user } = useContext(AuthContext);
  return (
    <div className="luxury-bg">
      <div className="page-bg-image" style={bgStyle(pathname, user?.role)}></div>
      <div className="page-bg-overlay"></div>
    </div>
  );
};

export default BackgroundDesign;
