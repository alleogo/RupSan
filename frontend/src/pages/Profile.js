import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import api, { settingsApi, getMediaUrl } from '../utils/api';
import ImageCropper from '../components/ImageCropper';

const Profile = () => {
  const { user } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    aadharNumber: '',
    phoneNumber: '',
    centre: ''
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  
  const [settings, setSettings] = useState(null);
  const [navbarSettings, setNavbarSettings] = useState({ title: '', logoText: '' });
  const [cropperImageSrc, setCropperImageSrc] = useState(null);

  // We need to fetch the latest user info from DB to get these fields,
  // or they might be in `user` from AuthContext if we update it.
  // For safety, let's just use what's in `user` context for now if available,
  // but a fresh fetch is better. Let's assume they are empty initially unless user context has them.
  useEffect(() => {
    if (user) {
      setFormData({
        aadharNumber: user.aadharNumber || '',
        phoneNumber: user.phoneNumber || '',
        centre: user.centre || ''
      });
    }
    if (user?.role === 'Admin') {
      const fetchSettings = async () => {
        try {
          const res = await settingsApi.get();
          if (res.data.success) {
            setSettings(res.data.settings);
            setNavbarSettings({
              title: res.data.settings.navbarTitle || '',
              logoText: res.data.settings.navbarLogoText || ''
            });
          }
        } catch (err) {}
      };
      fetchSettings();
    }
  }, [user]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCropperImageSrc(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const handleUpdateNavbarSettings = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setMsg({ text: '', type: '' });
    try {
      const formData = new FormData();
      formData.append('navbarTitle', navbarSettings.title);
      formData.append('navbarLogoText', navbarSettings.logoText);
      const res = await settingsApi.update(formData);
      if (res.data.success) {
        setMsg({ text: 'Navbar settings updated successfully! Refresh to see changes globally.', type: 'success' });
        setSettings(res.data.settings);
      }
    } catch (err) {
      setMsg({ text: 'Failed to update navbar settings', type: 'error' });
    }
    setLoading(false);
  };

  const handleUpdateLogo = async (blob) => {
    if (!blob) return;
    setLoading(true);
    setMsg({ text: '', type: '' });
    try {
      const formData = new FormData();
      formData.append('navbarLogo', blob, 'navbar-logo.jpg');
      console.log('Uploading logo, blob size:', blob.size, 'type:', blob.type);
      const res = await settingsApi.update(formData);
      console.log('Upload response:', res.data);
      if (res.data.success) {
        setMsg({ text: 'Logo updated successfully! Refresh to see changes globally.', type: 'success' });
        setSettings(res.data.settings);
        setCropperImageSrc(null);
      }
    } catch (error) {
      console.error('Logo upload error:', error.response?.data || error.message || error);
      const errMsg = error.response?.data?.message || 'Failed to update logo';
      setMsg({ text: errMsg, type: 'error' });
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ text: '', type: '' });
    
    try {
      const res = await api.put('/user/profile', formData);
      if (res.data.success) {
        setMsg({ text: 'Profile updated successfully!', type: 'success' });
        // Optionally update the context here, but we might need page refresh for now
      }
    } catch (error) {
      setMsg({ text: error.response?.data?.message || 'Failed to update profile', type: 'error' });
    }
    setLoading(false);
  };

  const handleRequestVerification = async () => {
    setLoading(true);
    setMsg({ text: '', type: '' });
    try {
      const res = await api.post('/user/request-verification');
      if (res.data.success) {
        setMsg({ text: 'Verification requested successfully! Wait for Admin approval.', type: 'success' });
      }
    } catch (error) {
      setMsg({ text: error.response?.data?.message || 'Failed to request verification', type: 'error' });
    }
    setLoading(false);
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div className="animate-fade-in" style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px' }}>My Profile</h2>
      
      <Card>
        <div style={{ marginBottom: '20px' }}>
          <h3>Personal Information</h3>
          <p><strong>Name:</strong> {user.firstName} {user.lastName}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Role:</strong> {user.role}</p>
          
          {user.role === 'Participant' && (
            <p>
              <strong>Verification Status:</strong>{' '}
              <span style={{ 
                color: user.verificationStatus === 'Verified' ? 'var(--accent-success)' : 
                       user.verificationStatus === 'Pending' ? 'var(--accent-warning)' : 'var(--accent-danger)',
                fontWeight: 'bold'
              }}>
                {user.verificationStatus || 'Unverified'}
              </span>
            </p>
          )}
        </div>

        {msg.text && (
          <div style={{ 
            color: msg.type === 'error' ? 'var(--accent-danger)' : 'var(--accent-success)', 
            background: msg.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
            padding: '10px', 
            borderRadius: '4px', 
            marginBottom: '16px' 
          }}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleUpdate}>
          <Input label="Aadhar Number" name="aadharNumber" value={formData.aadharNumber} onChange={handleChange} placeholder="1234 5678 9012" />
          <Input label="Phone Number" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="+91 9876543210" />
          <Input label="Centre" name="centre" value={formData.centre} onChange={handleChange} placeholder="Centre" />
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <Button type="submit" disabled={loading}>Update Details</Button>
            
            {user.role === 'Participant' && user.verificationStatus !== 'Verified' && user.verificationStatus !== 'Pending' && (
              <Button 
                type="button" 
                onClick={handleRequestVerification} 
                disabled={loading}
                style={{ background: 'var(--accent-primary)' }}
              >
                Request Verification
              </Button>
            )}
          </div>
        </form>
      </Card>

      {user.role === 'Admin' && (
        <Card style={{ marginTop: '24px' }}>
          <h3 style={{ marginBottom: '20px' }}>Global Settings</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>Customize the Navbar logo and title displayed across the app.</p>
          
          <div style={{ marginBottom: '24px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <h4 style={{ marginBottom: '12px' }}>Logo Image</h4>
            {settings?.navbarLogo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                <img src={getMediaUrl(settings.navbarLogo)} alt="Logo" style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }} />
                <span style={{ color: 'var(--accent-success)', fontSize: '0.9rem' }}>✅ Logo is set</span>
              </div>
            ) : (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>No logo image set. Text logo will be used.</p>
            )}
            {cropperImageSrc ? (
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px' }}>
                <ImageCropper 
                  imageSrc={cropperImageSrc} 
                  onCrop={handleUpdateLogo} 
                  onCancel={() => setCropperImageSrc(null)} 
                />
              </div>
            ) : (
              <input type="file" accept="image/*" className="input-field" onChange={handleFileSelect} />
            )}
          </div>

          <form onSubmit={handleUpdateNavbarSettings}>
            <Input label="Logo Text (Fallback if no image)" name="logoText" value={navbarSettings.logoText} onChange={(e) => setNavbarSettings({...navbarSettings, logoText: e.target.value})} maxLength={4} />
            <Input label="Navbar Title" name="title" value={navbarSettings.title} onChange={(e) => setNavbarSettings({...navbarSettings, title: e.target.value})} />
            
            <div style={{ marginTop: '16px' }}>
              <Button type="submit" disabled={loading}>Update Navbar Settings</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
};

export default Profile;
