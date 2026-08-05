import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { yatraApi, transactionApi, authApi, registrationApi, settingsApi, getMediaUrl } from '../utils/api';
import ImageCropper from '../components/ImageCropper';

const Dashboard = () => {
  const [ledgerSummary, setLedgerSummary] = useState({ totalIncome: 0, totalExpense: 0, balance: 0 });
  const [yatras, setYatras] = useState([]);
  const [unverifiedUsers, setUnverifiedUsers] = useState([]);
  const [pendingManagers, setPendingManagers] = useState([]);
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editingThumbnailType, setEditingThumbnailType] = useState('');
  const [newThumbnailFile, setNewThumbnailFile] = useState(null);
  const [cropperImageSrc, setCropperImageSrc] = useState(null);
  const { user } = React.useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    const fetchData = async () => {
      try {
        const isManagerOrAdmin = user?.role === 'Admin' || user?.role === 'Manager';
        let summaryRes = null;
        if (isManagerOrAdmin) {
          summaryRes = await transactionApi.getSummary().catch(() => null);
        }
        const yatrasRes = await yatraApi.getAll();
        let usersRes = null, managersRes = null;
        if (user?.role === 'Admin') {
          usersRes = await require('../utils/api').userApi.getUnverified().catch(() => null);
          managersRes = await authApi.getPendingManagers().catch(() => null);
        }
        if (user?.role === 'Participant') {
          const myRegRes = await registrationApi.myRegistrations().catch(() => null);
          if (myRegRes?.data.success) setMyRegistrations(myRegRes.data.registrations);
        }
        if (summaryRes?.data.success) setLedgerSummary(summaryRes.data.summary);
        if (yatrasRes.data.success) setYatras(yatrasRes.data.yatras);
        if (usersRes?.data.success) setUnverifiedUsers(usersRes.data.users);
        if (managersRes?.data.success) setPendingManagers(managersRes.data.managers);
        
        const settingsRes = await settingsApi.get().catch(() => null);
        if (settingsRes?.data?.success) setSettings(settingsRes.data.settings);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, navigate]);

  const handleCreateYatra = () => {};

  const handleVerifyUser = async (userId, action) => {
    try {
      const res = await require('../utils/api').userApi.verify(userId, action);
      if (res.data.success) setUnverifiedUsers(unverifiedUsers.filter(u => u._id !== userId));
    } catch { alert("Failed to update user"); }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCropperImageSrc(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleUpdateThumbnail = async (croppedBlob) => {
    if (!croppedBlob) return;
    try {
      const formData = new FormData();
      const filename = editingThumbnailType + '-thumbnail.jpg';
      if (editingThumbnailType === 'accounts') formData.append('accountsThumbnail', croppedBlob, filename);
      if (editingThumbnailType === 'yatra') formData.append('yatraThumbnail', croppedBlob, filename);
      const res = await settingsApi.update(formData);
      if (res.data.success) {
        setSettings(res.data.settings);
        setIsSettingsModalOpen(false);
        setCropperImageSrc(null);
        setNewThumbnailFile(null);
      }
    } catch (error) {
      alert("Failed to update thumbnail");
    }
  };

  const handleApproveManager = async (managerId, action) => {
    try {
      const res = await authApi.approveManager(managerId, action);
      if (res.data.success) setPendingManagers(pendingManagers.filter(m => m._id !== managerId));
    } catch { alert("Failed to update manager"); }
  };

  // Filter correctly — only Upcoming and Ongoing are "active"
  const activeYatras = yatras.filter(y => y.status === 'Upcoming' || y.status === 'Ongoing');
  const pastYatras = yatras.filter(y => y.status === 'Completed');
  const isManagerOrAdmin = user?.role === 'Admin' || user?.role === 'Manager';

  const myRegMap = {};
  myRegistrations.forEach(reg => { if (reg.yatra) myRegMap[reg.yatra._id] = reg; });

  if (loading) return <div style={{ padding: '24px', textAlign: 'center' }}>Loading dashboard...</div>;

  const YatraCard = ({ yatra, isPast = false }) => {
    const myReg = myRegMap[yatra._id];
    const paidTotal = (myReg?.paidOnline || 0) + (myReg?.paidCash || 0);
    const leftToPay = myReg ? Math.max(0, (myReg.amountToBePaid || 0) - paidTotal) : null;
    const statusColor = yatra.status === 'Ongoing' ? 'var(--accent-success)' : yatra.status === 'Completed' ? 'var(--text-secondary)' : 'var(--accent-primary)';
    const statusBg = yatra.status === 'Ongoing' ? 'rgba(16,185,129,0.15)' : yatra.status === 'Completed' ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.15)';

    const userId = user?._id || user?.id;
    const isOwner = (yatra?.createdBy?._id || yatra?.createdBy)?.toString() === userId?.toString();
    let buttonText = 'View Yatra';
    if (user?.role === 'Admin' || (user?.role === 'Manager' && isOwner)) buttonText = 'Manage Details';
    else if (user?.role === 'Manager') buttonText = 'Open details';

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
          {user?.role === 'Participant' && myReg?.status === 'Approved' && (
            <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(99,102,241,0.07)', borderRadius: '8px', fontSize: '0.84rem', borderLeft: '3px solid var(--accent-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Yatra Amount</span><span>₹{myReg.amountToBePaid || yatra.registrationFee}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Paid</span><span style={{ color: 'var(--accent-success)' }}>₹{paidTotal}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}><span style={{ color: 'var(--text-secondary)' }}>Remaining</span><span style={{ color: leftToPay > 0 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>₹{leftToPay}</span></div>
            </div>
          )}
          {user?.role === 'Participant' && myReg?.status === 'Pending' && (
            <p style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--accent-warning)' }}>⏳ Enrollment pending approval</p>
          )}
          <div style={{ marginTop: '14px' }}>
            <Link to={`/yatra/${yatra._id}`} style={{ textDecoration: 'none' }}>
              <Button variant={isPast ? 'default' : 'primary'}>
                {buttonText}
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <>
      <div className="animate-fade-in" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>

        {isManagerOrAdmin ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <div>
                <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Dashboard</h1>
                <p>Welcome back, {user?.firstName}!</p>
              </div>
            </div>

            {/* Two big section cards side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '32px', marginBottom: '40px' }}>

              {/* === ACCOUNTS MANAGEMENT CARD === */}
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: '100%', height: '260px', background: 'linear-gradient(135deg,rgba(16,185,129,0.25),rgba(16,185,129,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {settings?.accountsThumbnail ? (
                    <img src={getMediaUrl(settings.accountsThumbnail)} alt="Accounts" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '6rem' }}>💼</span>
                  )}
                </div>
                <div style={{ padding: '32px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '1.6rem' }}>Accounts Management</h2>
                    {user?.role === 'Admin' && (
                      <Button variant="default" style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto' }} onClick={() => { setEditingThumbnailType('accounts'); setIsSettingsModalOpen(true); }}>Edit Image</Button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '28px' }}>
                    <div style={{ background: 'rgba(16,185,129,0.1)', borderLeft: '4px solid var(--accent-success)', padding: '16px', borderRadius: '8px' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '4px' }}>Income</p>
                      <p style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--accent-success)' }}>₹{ledgerSummary.totalIncome.toLocaleString()}</p>
                    </div>
                    <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid var(--accent-danger)', padding: '16px', borderRadius: '8px' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '4px' }}>Expenses</p>
                      <p style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--accent-danger)' }}>₹{ledgerSummary.totalExpense.toLocaleString()}</p>
                    </div>
                    <div style={{ background: 'rgba(99,102,241,0.1)', borderLeft: '4px solid var(--accent-primary)', padding: '16px', borderRadius: '8px' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '4px' }}>Balance</p>
                      <p style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--accent-primary)' }}>₹{ledgerSummary.balance.toLocaleString()}</p>
                    </div>
                  </div>
                  <Link to="/ledger" style={{ textDecoration: 'none' }}>
                    <Button variant="default" style={{ width: '100%', fontSize: '1rem', padding: '12px' }}>View Full Ledger →</Button>
                  </Link>
                </div>
              </div>

              {/* === YATRA MANAGEMENT CARD === */}
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: '100%', height: '260px', background: 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(99,102,241,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {settings?.yatraThumbnail ? (
                    <img src={getMediaUrl(settings.yatraThumbnail)} alt="Yatra" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '6rem' }}>🛕</span>
                  )}
                </div>
                <div style={{ padding: '32px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '1.6rem' }}>Yatra Management</h2>
                    {user?.role === 'Admin' && (
                      <Button variant="default" style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto' }} onClick={() => { setEditingThumbnailType('yatra'); setIsSettingsModalOpen(true); }}>Edit Image</Button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '28px' }}>
                    <div style={{ background: 'rgba(99,102,241,0.1)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                      <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--accent-primary)' }}>{yatras.filter(y => y.status === 'Upcoming').length}</p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Upcoming</p>
                    </div>
                    <div style={{ background: 'rgba(16,185,129,0.1)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                      <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--accent-success)' }}>{yatras.filter(y => y.status === 'Ongoing').length}</p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Ongoing</p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.04)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                      <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-secondary)' }}>{pastYatras.length}</p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Completed</p>
                    </div>
                  </div>
                  <Link to="/yatra-management" style={{ textDecoration: 'none' }}>
                    <Button variant="primary" style={{ width: '100%', fontSize: '1rem', padding: '12px' }}>Manage Yatras & Create New →</Button>
                  </Link>
                </div>
              </div>
            </div>

          </>
        ) : (
          /* === PARTICIPANT LAYOUT === */
          <>
            <div style={{ marginBottom: '32px' }}>
              <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>My Dashboard</h1>
              <p>Welcome back, {user?.firstName}! View and manage your Yatras below.</p>
            </div>

            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ marginBottom: '20px' }}>Active Yatras</h2>
              {activeYatras.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>No active yatras at the moment.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                  {activeYatras.map(y => <YatraCard key={y._id} yatra={y} />)}
                </div>
              )}
            </div>

          </>
        )}

        {/* Admin: pending verifications */}
        {user?.role === 'Admin' && unverifiedUsers.length > 0 && (
          <div style={{ marginTop: '40px' }}>
            <h2>Pending Participant Verifications</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px,1fr))', gap: '20px', marginTop: '16px' }}>
              {unverifiedUsers.map(u => (
                <Card key={u._id} style={{ borderLeft: '4px solid var(--accent-warning)' }}>
                  <h3 style={{ marginBottom: '8px' }}>{u.firstName} {u.lastName}</h3>
                  <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}><strong>Email:</strong> {u.email}</p>
                  <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}><strong>Aadhar:</strong> {u.aadharNumber}</p>
                  <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}><strong>Phone:</strong> {u.phoneNumber}</p>
                  <p style={{ fontSize: '0.9rem', marginBottom: '16px' }}><strong>Centre:</strong> {u.centre}</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="primary" onClick={() => handleVerifyUser(u._id, 'Verify')} style={{ flex: 1, padding: '8px' }}>Approve</Button>
                    <Button variant="danger" onClick={() => handleVerifyUser(u._id, 'Reject')} style={{ flex: 1, padding: '8px' }}>Reject</Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {user?.role === 'Admin' && pendingManagers.length > 0 && (
          <div style={{ marginTop: '40px' }}>
            <h2>Pending Manager Approvals</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px,1fr))', gap: '20px', marginTop: '16px' }}>
              {pendingManagers.map(m => (
                <Card key={m._id} style={{ borderLeft: '4px solid var(--accent-primary)' }}>
                  <h3 style={{ marginBottom: '8px' }}>{m.firstName} {m.lastName}</h3>
                  <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}><strong>Email:</strong> {m.email}</p>
                  <p style={{ fontSize: '0.9rem', marginBottom: '16px', color: 'var(--text-secondary)' }}>Status: {m.status}</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="primary" onClick={() => handleApproveManager(m._id, 'Approve')} style={{ flex: 1, padding: '8px' }}>Approve</Button>
                    <Button variant="danger" onClick={() => handleApproveManager(m._id, 'Reject')} style={{ flex: 1, padding: '8px' }}>Reject</Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal for Thumbnails */}
      {isSettingsModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', zIndex: 1000, backdropFilter: 'blur(4px)', overflowY: 'auto', padding: '40px 20px' }}>
          <div className="animate-fade-in" style={{ width: '100%', maxWidth: '640px', margin: 'auto' }}>
            {cropperImageSrc ? (
              <ImageCropper
                imageSrc={cropperImageSrc}
                onCrop={(blob) => handleUpdateThumbnail(blob)}
                onCancel={() => { setCropperImageSrc(null); setIsSettingsModalOpen(false); }}
              />
            ) : (
              <div style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)' }}>
                <h2 style={{ marginBottom: '16px' }}>Update Thumbnail</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                  Select a high-resolution image. You'll be able to drag and zoom to choose the exact portion to display.
                </p>
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Select Image</label>
                  <input type="file" accept="image/*" className="input-field" onChange={handleFileSelect} />
                </div>
                <Button variant="default" onClick={() => setIsSettingsModalOpen(false)} style={{ width: '100%' }}>Cancel</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Dashboard;
