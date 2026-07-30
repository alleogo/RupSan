import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiLayout, FiUser, FiLogOut } from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';
import { settingsApi, getMediaUrl } from '../utils/api';

const Navbar = () => {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await settingsApi.get();
        if (res.data.success) {
          setSettings(res.data.settings);
        }
      } catch (error) {
        console.error("Failed to fetch settings", error);
      }
    };
    fetchSettings();
  }, []);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  
  const isActive = (path) => location.pathname === path ? 'var(--accent-primary)' : 'var(--text-secondary)';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={{ 
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ display: 'block', width: '80px', height: '80px', flexShrink: 0, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}>
          {settings?.navbarLogo ? (
            <img src={getMediaUrl(settings.navbarLogo)} alt="Logo" style={{
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
              {settings?.navbarLogoText || 'AM'}
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <h2 style={{ 
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
            {settings?.navbarTitle || 'Accounts Management'}
          </h2>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
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
