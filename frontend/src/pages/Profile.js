import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import api, { settingsApi, getImageUrl, centreApi, userApi } from '../utils/api';
import AadharCardLink from '../components/AadharCardLink';
import ImageCropper, { YATRA_CARD_ASPECT, YATRA_CARD_ASPECT_CSS } from '../components/ImageCropper';
import ManagerAccessCard from '../components/ManagerAccessCard';

const Profile = () => {
  const { user, setUser } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    centreId: ''
  });
  const [centres, setCentres] = useState([]);
  const [uploadingCard, setUploadingCard] = useState(false);
  const [centreDetails, setCentreDetails] = useState(null);
  const myCentreId = user?.centreId?._id || user?.centreId || '';

  // Details of the user's own centre (description, location, project manager)
  useEffect(() => {
    if (!myCentreId) { setCentreDetails(null); return; }
    centreApi.details(myCentreId).then(res => setCentreDetails(res.data.centre)).catch(() => setCentreDetails(null));
  }, [myCentreId]);

  useEffect(() => {
    centreApi.list().then(res => { if (res.data.success) setCentres(res.data.centres); }).catch(() => {});
  }, []);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  
  const [settings, setSettings] = useState(null);
  const [navbarSettings, setNavbarSettings] = useState({ title: '', logoText: '' });
  const [cropperImageSrc, setCropperImageSrc] = useState(null);
  const [bannerCrop, setBannerCrop] = useState(null); // { field, src } while cropping a dashboard image

  // We need to fetch the latest user info from DB to get these fields,
  // or they might be in `user` from AuthContext if we update it.
  // For safety, let's just use what's in `user` context for now if available,
  // but a fresh fetch is better. Let's assume they are empty initially unless user context has them.
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        centreId: user.centreId?._id || user.centreId || ''
      });
    }
    if (user?.role === 'SuperAdmin') {
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

  // Super Admin: change a dashboard image (5:2, same shape as the cards that show it)
  const handleUpdateBanner = async (field, blob) => {
    if (!blob) return;
    setLoading(true);
    setMsg({ text: '', type: '' });
    try {
      const formData = new FormData();
      formData.append(field, blob, `${field}.jpg`);
      const res = await settingsApi.update(formData);
      if (res.data.success) {
        setSettings(res.data.settings);
        setBannerCrop(null);
        setMsg({ text: 'Dashboard image updated.', type: 'success' });
      }
    } catch (error) {
      setMsg({ text: error.response?.data?.message || 'Could not update the image.', type: 'error' });
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
        setMsg({ text: res.data.message, type: 'success' });
        // Update user context and localStorage
        const updatedUser = res.data.user;
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
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
        setMsg({ text: "Verification requested. Your centre's admin will check your details.", type: 'success' });
        setUser(res.data.user);
        localStorage.setItem('user', JSON.stringify(res.data.user));
      }
    } catch (error) {
      setMsg({ text: error.response?.data?.message || 'Failed to request verification', type: 'error' });
    }
    setLoading(false);
  };

  const handleAadharUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = null;
    if (!file) return;
    if (!file.type.startsWith('image/')) return setMsg({ text: 'Choose a photo (JPG or PNG) of your Aadhaar card.', type: 'error' });
    if (file.size > 4 * 1024 * 1024) return setMsg({ text: 'The photo must be smaller than 4MB.', type: 'error' });
    setUploadingCard(true);
    setMsg({ text: '', type: '' });
    try {
      const data = new FormData();
      data.append('aadharCard', file);
      const res = await userApi.uploadAadharCard(data);
      setUser(res.data.user);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setMsg({ text: 'Aadhaar card uploaded.', type: 'success' });
    } catch (error) {
      setMsg({ text: error.response?.data?.message || 'Could not upload the Aadhaar card.', type: 'error' });
    }
    setUploadingCard(false);
  };

  if (!user) return <div>Loading...</div>;

  const isParticipant = user.role === 'Participant';
  const savedCentreId = user.centreId?._id || user.centreId || '';
  // Participants can change centre; managers from before centres pick one once (then need approval)
  const canPickCentre = isParticipant || (user.role === 'Manager' && !savedCentreId);
  const missingForVerification = [
    !user.phoneNumber && 'phone number',
    !savedCentreId && 'centre',
    !user.aadharCard?.uploadedAt && 'Aadhaar card photo'
  ].filter(Boolean);

  return (
    <div className="animate-fade-in" style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px' }}>My Profile</h2>
      
      <Card>
        <div style={{ marginBottom: '20px' }}>
          <h3>Personal Information</h3>
          <p><strong>Role:</strong> {user.role === 'SuperAdmin' ? 'Super Admin' : user.role}{user.centreId?.name ? ` · ${user.centreId.name}` : ''}</p>
          
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
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <Input label="First Name" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="First Name" />
            </div>
            <div style={{ flex: 1 }}>
              <Input label="Last Name" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Last Name" />
            </div>
          </div>
          <Input label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="email@example.com" />
          <Input label="Phone Number" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="+91 9876543210" />
          {/* The Super Admin doesn't belong to a centre and isn't verified */}
          {user.role !== 'SuperAdmin' && (
          <>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="profile-centre" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Centre</label>
            <select id="profile-centre" name="centreId" value={formData.centreId} onChange={handleChange} className="input-field" disabled={!canPickCentre} style={{ cursor: canPickCentre ? 'pointer' : 'not-allowed' }}>
              <option value="">Choose your centre</option>
              {centres.map(c => <option key={c._id} value={c._id}>{c.name}{c.place ? ` — ${c.place}` : ''}</option>)}
            </select>
            {isParticipant && formData.centreId && formData.centreId !== savedCentreId && savedCentreId && (
              <p style={{ fontSize: '0.8rem', marginTop: '6px', color: 'var(--accent-warning)' }}>Changing your centre means the new centre's admin has to verify you again.</p>
            )}
            {!canPickCentre && <p style={{ fontSize: '0.8rem', marginTop: '6px' }}>Ask your centre's admin if your centre needs to change.</p>}
            {user.role === 'Manager' && !savedCentreId && <p style={{ fontSize: '0.8rem', marginTop: '6px', color: 'var(--accent-warning)' }}>Choose your centre. Its admin will then approve you as a manager there.</p>}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <span style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Aadhaar card</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {user.aadharCard?.uploadedAt ? (
                <>
                  <span style={{ fontSize: '0.9rem', color: 'var(--accent-success)' }}>✓ Uploaded {new Date(user.aadharCard.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <AadharCardLink userId={user._id || user.id} label="View my card" />
                </>
              ) : (
                <span style={{ fontSize: '0.9rem' }}>Not uploaded yet</span>
              )}
              <label style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', cursor: uploadingCard ? 'wait' : 'pointer', textDecoration: 'underline' }}>
                {uploadingCard ? 'Uploading…' : user.aadharCard?.uploadedAt ? 'Replace photo' : 'Upload photo'}
                <input type="file" accept="image/*" onChange={handleAadharUpload} disabled={uploadingCard} style={{ display: 'none' }} />
              </label>
            </div>
            <p style={{ fontSize: '0.8rem', marginTop: '6px' }}>A clear photo of the front of your card. Only your centre's admins can see it.</p>
          </div>
          </>
          )}
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <Button type="submit" disabled={loading}>Update Details</Button>
            
            {isParticipant && user.verificationStatus !== 'Verified' && user.verificationStatus !== 'Pending' && missingForVerification.length === 0 && (
              <Button 
                type="button" 
                onClick={handleRequestVerification} 
                disabled={loading}
              >
                Request Verification
              </Button>
            )}
          </div>
        </form>
        {isParticipant && user.verificationStatus !== 'Verified' && user.verificationStatus !== 'Pending' && missingForVerification.length > 0 && (
          <p style={{ fontSize: '0.85rem', marginTop: '12px', color: 'var(--accent-warning)' }}>To get verified, add your {missingForVerification.join(', ')} and save.</p>
        )}
      </Card>

      {centreDetails && (
        <Card style={{ marginTop: '24px' }}>
          <h3 style={{ marginBottom: '4px' }}>Your centre: {centreDetails.name}</h3>
          {centreDetails.place && <p style={{ fontSize: '0.9rem', marginBottom: '8px' }}>{centreDetails.place}</p>}
          {centreDetails.description && <p style={{ marginBottom: '12px' }}>{centreDetails.description}</p>}
          {centreDetails.location && (
            <p style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
              📍 {centreDetails.location} ·{' '}
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([centreDetails.location, centreDetails.place].filter(Boolean).join(', '))}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>View on map</a>
            </p>
          )}
          {centreDetails.pm?.name && (
            <p style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
              Project manager: <span style={{ color: 'var(--text-primary)' }}>{centreDetails.pm.name}</span>
              {centreDetails.pm.phone && <> · <a href={`tel:${centreDetails.pm.phone}`} style={{ color: 'var(--accent-primary)' }}>{centreDetails.pm.phone}</a></>}
              {centreDetails.pm.email && <> · <a href={`mailto:${centreDetails.pm.email}`} style={{ color: 'var(--accent-primary)' }}>{centreDetails.pm.email}</a></>}
            </p>
          )}
          {centreDetails.admin && <p style={{ fontSize: '0.9rem' }}>Admin: <span style={{ color: 'var(--text-primary)' }}>{centreDetails.admin.firstName} {centreDetails.admin.lastName}</span></p>}
        </Card>
      )}

      <ManagerAccessCard />

      {user.role === 'SuperAdmin' && (
        <Card style={{ marginTop: '24px' }}>
          <h3 style={{ marginBottom: '20px' }}>Global Settings</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>Customize the Navbar logo and title displayed across the app.</p>
          
          <div style={{ marginBottom: '24px', background: 'rgba(var(--tint-rgb),0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <h4 style={{ marginBottom: '12px' }}>Logo Image</h4>
            {settings?.navbarLogo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                <img src={getImageUrl(settings.navbarLogo, 160)} alt="Logo" style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }} />
                <span style={{ color: 'var(--accent-success)', fontSize: '0.9rem' }}>✅ Logo is set</span>
              </div>
            ) : (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>No logo image set. Text logo will be used.</p>
            )}
            {cropperImageSrc ? (
              <div style={{ background: 'var(--inset-bg)', padding: '16px', borderRadius: '8px' }}>
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

          <div style={{ marginTop: '24px', background: 'rgba(var(--tint-rgb),0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <h4 style={{ marginBottom: '4px' }}>Dashboard images</h4>
            <p style={{ fontSize: '0.85rem', marginBottom: '16px' }}>Shown on every admin's and manager's dashboard.</p>
            {bannerCrop ? (
              <ImageCropper
                aspect={YATRA_CARD_ASPECT}
                imageSrc={bannerCrop.src}
                onCrop={(blob) => handleUpdateBanner(bannerCrop.field, blob)}
                onCancel={() => setBannerCrop(null)}
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '16px' }}>
                {[['accountsThumbnail', 'Accounts Management'], ['yatraThumbnail', 'Yatra Management']].map(([field, label]) => (
                  <div key={field}>
                    <div style={{ width: '100%', aspectRatio: YATRA_CARD_ASPECT_CSS, borderRadius: '8px', overflow: 'hidden', background: 'rgba(var(--tint-rgb),0.05)', marginBottom: '8px' }}>
                      {settings?.[field] && <img src={getImageUrl(settings[field], 600)} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{label}</span>
                      <label style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', cursor: 'pointer', textDecoration: 'underline' }}>
                        Change
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                          const file = e.target.files[0];
                          e.target.value = null;
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => setBannerCrop({ field, src: ev.target.result });
                          reader.readAsDataURL(file);
                        }} />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default Profile;
