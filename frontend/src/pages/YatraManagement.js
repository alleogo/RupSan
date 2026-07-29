import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { yatraApi, getMediaUrl } from '../utils/api';
import ImageCropper from '../components/ImageCropper';

const YatraManagement = () => {
  const [yatras, setYatras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newYatra, setNewYatra] = useState({
    title: '', description: '', startDate: '', endDate: '',
    destination: '', registrationFee: '', upiId: '',
    thumbnail: null, qrCode: null
  });
  const [cropperImageSrc, setCropperImageSrc] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCropperImageSrc(ev.target.result);
    reader.readAsDataURL(file);
  };

  const { user } = React.useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || (user.role !== 'Manager' && user.role !== 'Admin')) {
      navigate('/');
      return;
    }
    const fetchData = async () => {
      try {
        const yatrasRes = await yatraApi.getAll();
        if (yatrasRes.data.success) setYatras(yatrasRes.data.yatras);
      } catch (error) {
        console.error("Failed to fetch yatras:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, navigate]);

  const handleCreateYatra = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('title', newYatra.title);
      formData.append('description', newYatra.description);
      formData.append('startDate', newYatra.startDate);
      formData.append('endDate', newYatra.endDate);
      formData.append('destination', newYatra.destination);
      formData.append('registrationFee', newYatra.registrationFee);
      if (newYatra.upiId) formData.append('upiId', newYatra.upiId);
      if (newYatra.thumbnail) formData.append('thumbnail', newYatra.thumbnail);
      if (newYatra.qrCode) formData.append('qrCode', newYatra.qrCode);

      const res = await yatraApi.create(formData);
      if (res.data.success) {
        setYatras([res.data.yatra, ...yatras]);
        setIsModalOpen(false);
        setNewYatra({ title: '', description: '', startDate: '', endDate: '', destination: '', registrationFee: '', upiId: '', thumbnail: null, qrCode: null });
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create yatra');
    }
  };

  const activeYatras = yatras.filter(y => y.status === 'Upcoming' || y.status === 'Ongoing');
  const myCreatedYatras = activeYatras.filter(y => y.createdBy && (y.createdBy._id === user?.id || y.createdBy._id === user?._id || y.createdBy === user?.id || y.createdBy === user?._id));
  const otherActiveYatras = activeYatras.filter(y => !y.createdBy || (y.createdBy._id !== user?.id && y.createdBy._id !== user?._id && y.createdBy !== user?.id && y.createdBy !== user?._id));

  if (loading) return <div style={{ padding: '24px', textAlign: 'center' }}>Loading...</div>;

  const YatraCard = ({ yatra }) => {
    const statusColor = yatra.status === 'Ongoing' ? 'var(--accent-success)' : 'var(--accent-primary)';
    const statusBg = yatra.status === 'Ongoing' ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)';

    return (
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {yatra.thumbnail ? (
          <img src={getMediaUrl(yatra.thumbnail)} alt={yatra.title}
            style={{ width: '100%', height: '150px', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100px', background: 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(16,185,129,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '2.5rem' }}>🛕</span>
          </div>
        )}
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', flex: 1 }}>{yatra.title}</h3>
            <span style={{ background: statusBg, color: statusColor, padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', marginLeft: '8px', whiteSpace: 'nowrap' }}>
              {yatra.status}
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>📍 {yatra.destination}</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>
            📅 {new Date(yatra.startDate).toLocaleDateString()} – {new Date(yatra.endDate).toLocaleDateString()}
          </p>
          {yatra.createdBy && (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>
              👤 Manager: {yatra.createdBy.firstName} {yatra.createdBy.lastName}
            </p>
          )}
          <div style={{ marginTop: '14px' }}>
            <Link to={`/yatra/${yatra._id}`} style={{ textDecoration: 'none' }}>
              <Button variant="primary">Manage Details</Button>
            </Link>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <>
      <div className="animate-fade-in" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>🛕 Yatra Management</h1>
            <p>Manage active yatras or create a new one.</p>
          </div>
          {(user?.role === 'Manager' && user?.status === 'Approved') || user?.role === 'Admin' ? (
            <Button style={{ width: 'auto', padding: '10px 20px', fontSize: '0.95rem' }} onClick={() => setIsModalOpen(true)}>
              + Create New Yatra
            </Button>
          ) : user?.role === 'Manager' ? (
            <Button style={{ width: 'auto', padding: '10px 20px', fontSize: '0.95rem' }} disabled title="Account pending approval">🔒 New Yatra</Button>
          ) : null}
        </div>

        {/* My Created Yatras Section */}
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            My Created Yatras
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '400' }}>({myCreatedYatras.length})</span>
          </h2>
          {myCreatedYatras.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {myCreatedYatras.map(y => <YatraCard key={y._id} yatra={y} />)}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>You haven't created any yatras yet.</p>
          )}
        </div>

        {/* Other Active Yatras Section */}
        <div>
          <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {myCreatedYatras.length > 0 ? "Other Active Yatras" : "Active Yatras"}
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '400' }}>({otherActiveYatras.length})</span>
          </h2>
          {otherActiveYatras.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No other active yatras.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {otherActiveYatras.map(y => <YatraCard key={y._id} yatra={y} />)}
            </div>
          )}
        </div>
      </div>

      {/* Create Yatra Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="animate-fade-in" style={{ width: '100%', maxWidth: '540px', background: 'var(--bg-secondary)', padding: '28px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '20px' }}>Create New Yatra</h2>
            <form onSubmit={handleCreateYatra}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Title *</label>
                <input type="text" className="input-field" value={newYatra.title} onChange={e => setNewYatra({...newYatra, title: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Destination *</label>
                <input type="text" className="input-field" value={newYatra.destination} onChange={e => setNewYatra({...newYatra, destination: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Description *</label>
                <textarea className="input-field" value={newYatra.description} onChange={e => setNewYatra({...newYatra, description: e.target.value})} rows={2} required />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Start Date *</label>
                  <input type="date" className="input-field" value={newYatra.startDate} onChange={e => setNewYatra({...newYatra, startDate: e.target.value})} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>End Date *</label>
                  <input type="date" className="input-field" value={newYatra.endDate} onChange={e => setNewYatra({...newYatra, endDate: e.target.value})} required />
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Registration Fee (₹) *</label>
                <input type="number" className="input-field" value={newYatra.registrationFee} onChange={e => setNewYatra({...newYatra, registrationFee: e.target.value})} required />
              </div>

              {/* Thumbnail */}
              {cropperImageSrc ? (
                <div style={{ marginBottom: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                  <p style={{ fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>Crop your thumbnail image:</p>
                  <ImageCropper
                    imageSrc={cropperImageSrc}
                    onCrop={(blob) => {
                      setNewYatra({...newYatra, thumbnail: blob});
                      setCropperImageSrc(null);
                    }}
                    onCancel={() => setCropperImageSrc(null)}
                  />
                </div>
              ) : (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Thumbnail Image (optional)</label>
                  {newYatra.thumbnail && <p style={{ fontSize: '0.85rem', color: 'var(--accent-success)', marginBottom: '4px' }}>✅ Thumbnail selected and cropped successfully</p>}
                  <input type="file" accept="image/*" className="input-field" onChange={handleFileSelect} />
                </div>
              )}

              {/* Payment info */}
              <div style={{ padding: '14px', background: 'rgba(99,102,241,0.07)', borderRadius: '8px', marginBottom: '12px', border: '1px solid rgba(99,102,241,0.2)' }}>
                <p style={{ fontWeight: '600', marginBottom: '10px', fontSize: '0.9rem' }}>💳 Payment Details</p>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem' }}>UPI ID (optional)</label>
                  <input type="text" className="input-field" placeholder="e.g. name@upi" value={newYatra.upiId} onChange={e => setNewYatra({...newYatra, upiId: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem' }}>QR Code Image (optional)</label>
                  <input type="file" accept="image/*" className="input-field" onChange={e => setNewYatra({...newYatra, qrCode: e.target.files[0]})} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <Button variant="default" type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }}>Cancel</Button>
                <Button type="submit" variant="primary" style={{ flex: 1 }}>Create Yatra</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default YatraManagement;
