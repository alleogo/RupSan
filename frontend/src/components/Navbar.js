import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiLayout, FiUser, FiLogOut, FiMenu, FiX } from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import { settingsApi, getImageUrl } from '../utils/api';

// Built-in branding shown before settings load; keep in sync with the saved settings to avoid a flash
const DEFAULT_BRANDING = {
  navbarTitle: 'RupSan',
  navbarLogoText: 'RS',
  navbarLogo: 'https://res.cloudinary.com/ddxkr8fim/image/upload/v1785143094/RupSa/settings/nwexflkcesdzjault426.jpg'
};

const Navbar = () => {
  // Start from the last-seen settings (or the built-in branding) so nothing flashes on load
  const [settings, setSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('navbarSettings')) || DEFAULT_BRANDING;
    } catch {
      return DEFAULT_BRANDING;
    }
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await settingsApi.get();
        if (res.data.success) {
          setSettings(res.data.settings);
          try {
            localStorage.setItem('navbarSettings', JSON.stringify(res.data.settings));
          } catch {}
        }
      } catch (error) {
        console.error("Failed to fetch settings", error);
      }
    };
    fetchSettings();
  }, []);
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever the page changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);
  const { user, logout } = useContext(AuthContext);
  
  const isActive = (path) => location.pathname === path ? 'var(--accent-primary)' : 'var(--text-secondary)';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar" style={{ 
      background: 'var(--glass-bg)', 
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--glass-border)',
      padding: '16px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div className="navbar-brand" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div className="navbar-logo" style={{ display: 'block', width: '80px', height: '80px', flexShrink: 0, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}>
          {settings?.navbarLogo ? (
            <img src={getImageUrl(settings.navbarLogo, 160)} alt="Logo" style={{
              width: '100%', height: '100%', borderRadius: '12px', objectFit: 'cover'
            }} />
          ) : (
            <div style={{ 
              width: '100%', 
              height: '100%', 
              borderRadius: '12px', 
              background: 'linear-gradient(135deg, #FFF8DC, #FFD700, #B8860B, #FFD700)',
              backgroundSize: '200% 200%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: '#4A3500',
              fontWeight: '900',
              fontSize: '2.4rem',
              fontFamily: '"Playfair Display", "Cinzel", serif',
              boxShadow: 'inset 0 0 10px rgba(255,255,255,0.8), inset 0 -2px 5px rgba(0,0,0,0.3)',
              textShadow: '1px 1px 1px rgba(255,255,255,0.7), -1px -1px 1px rgba(0,0,0,0.2)'
            }}>
              {settings?.navbarLogoText || 'RS'}
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <h2 className="navbar-title" style={{ 
            fontSize: '2.8rem', 
            margin: 0, 
            fontFamily: '"Playfair Display", "Cinzel", serif',
            background: 'linear-gradient(to bottom, #FFF8DC 0%, #FFD700 30%, #B8860B 60%, #FFD700 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: '800',
            letterSpacing: '1px',
            paddingBottom: '4px',
            filter: 'drop-shadow(2px 3px 3px rgba(0,0,0,0.7)) drop-shadow(0 0 15px rgba(255,215,0,0.25))'
          }}>
            {settings?.navbarTitle || 'RupSan'}
          </h2>
        </div>
      </div>

      <button
        className="navbar-toggle"
        onClick={() => setMenuOpen(open => !open)}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
      >
        {menuOpen ? <FiX /> : <FiMenu />}
      </button>

      <div className={`navbar-links${menuOpen ? ' open' : ''}`} style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        <Link to="/" style={{ color: isActive('/'), textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', transition: 'var(--transition-fast)' }}>
          <FiLayout /> Dashboard
        </Link>
        <Link to="/previous-yatras" style={{ color: isActive('/previous-yatras'), textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', transition: 'var(--transition-fast)' }}>
          📜 Previous Yatras
        </Link>
        {user && (user.role === 'Manager' || user.role === 'Admin') && (
          <Link to="/ledger" style={{ color: isActive('/ledger'), textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', transition: 'var(--transition-fast)' }}>
            💰 Ledger
          </Link>
        )}
        {user ? (
          <>
            <Link to="/profile" style={{ color: isActive('/profile'), textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
              <FiUser /> {user.firstName} ({user.role})
            </Link>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', fontSize: '1rem' }}>
              <FiLogOut /> Logout
            </button>
          </>
        ) : (
          <Link to="/login" style={{ color: isActive('/login'), textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', transition: 'var(--transition-fast)' }}>
            <FiUser /> Login
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
