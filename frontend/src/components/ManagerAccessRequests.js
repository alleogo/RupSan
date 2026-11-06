import React, { useState, useEffect, useCallback } from 'react';
import Card from './Card';
import Button from './Button';
import { roleRequestApi } from '../utils/api';

// Admin dashboard panel: review requests for temporary manager access

const labelStyle = { display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' };
const formatDay = (date) => new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const windowText = (start, end) => (end ? `${formatDay(start)} – ${formatDay(end)}` : `From ${formatDay(start)}, no end date`);
const isoDay = (date) => (date ? new Date(date).toISOString().slice(0, 10) : '');

const PendingRequest = ({ request, onDone }) => {
  const [startDate, setStartDate] = useState(isoDay(request.startDate));
  const [endDate, setEndDate] = useState(isoDay(request.endDate));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const u = request.user || {};

  const review = async (action) => {
    setBusy(true);
    setError('');
    try {
      const body = action === 'Approve' ? { action, note, startDate, endDate } : { action, note };
      const res = await roleRequestApi.review(request._id, body);
      onDone(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update the request.');
      setBusy(false);
    }
  };

  return (
    <Card style={{ borderLeft: '4px solid var(--accent-primary)' }}>
      <h3 style={{ marginBottom: '6px' }}>{u.firstName} {u.lastName}</h3>
      <p style={{ fontSize: '0.85rem', overflowWrap: 'anywhere' }}>{u.email}{u.phoneNumber ? ` · ${u.phoneNumber}` : ''}</p>
      <p style={{ fontSize: '0.85rem', marginBottom: '10px' }}>
        Verification: <span style={{ color: u.verificationStatus === 'Verified' ? 'var(--accent-success)' : 'var(--accent-warning)' }}>{u.verificationStatus || 'Unverified'}</span>
      </p>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '4px' }}>Asked for: {windowText(request.startDate, request.endDate)}</p>
      <p style={{ fontSize: '0.9rem', fontStyle: 'italic', marginBottom: '14px' }}>“{request.reason}”</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <div>
          <label style={labelStyle} htmlFor={`start-${request._id}`}>From</label>
          <input id={`start-${request._id}`} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" style={{ padding: '8px' }} />
        </div>
        <div>
          <label style={labelStyle} htmlFor={`end-${request._id}`}>Until (blank = no end)</label>
          <input id={`end-${request._id}`} type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" style={{ padding: '8px' }} />
        </div>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} className="input-field" placeholder="Note to the user (optional)" style={{ marginBottom: '12px', padding: '8px' }} aria-label="Note to the user" />

      {error && <p role="alert" style={{ color: 'var(--accent-danger)', fontSize: '0.85rem', marginBottom: '10px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button variant="primary" disabled={busy} onClick={() => review('Approve')} style={{ flex: 1, padding: '8px' }}>Approve</Button>
        <Button variant="danger" disabled={busy} onClick={() => review('Reject')} style={{ flex: 1, padding: '8px' }}>Reject</Button>
      </div>
    </Card>
  );
};

const ManagerAccessRequests = () => {
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [history, setHistory] = useState(null); // loaded on demand
  const [showHistory, setShowHistory] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const [p, a] = await Promise.all([roleRequestApi.list('Pending'), roleRequestApi.list('Approved')]).catch(() => [null, null]);
    if (p?.data.success) setPending(p.data.requests);
    if (a?.data.success) setApproved(a.data.requests);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!showHistory) return;
    roleRequestApi.list('History').then(res => { if (res.data.success) setHistory(res.data.requests); }).catch(() => setHistory([]));
  }, [showHistory, notice]);

  const done = (message) => {
    setNotice(message);
    load();
  };

  const revoke = async (request) => {
    const name = `${request.user?.firstName || ''} ${request.user?.lastName || ''}`.trim();
    if (!window.confirm(`End ${name}'s manager access now? They will go back to participant access.`)) return;
    try {
      const res = await roleRequestApi.revoke(request._id);
      done(res.data.message);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not revoke access.');
    }
  };

  const now = Date.now();

  return (
    <div style={{ marginBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
        <h2>Manager Access Requests</h2>
        <button type="button" onClick={() => setShowHistory(s => !s)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.9rem' }}>
          {showHistory ? 'Hide past requests' : 'Show past requests'}
        </button>
      </div>

      {notice && <p role="status" style={{ color: 'var(--accent-success)', fontSize: '0.9rem', marginTop: '8px' }}>✓ {notice}</p>}

      {pending.length === 0 && approved.length === 0 && (
        <Card style={{ marginTop: '12px', padding: '16px 20px' }}>
          <p style={{ fontSize: '0.9rem' }}>No requests waiting. Participants can ask for manager access from their profile.</p>
        </Card>
      )}

      {pending.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))', gap: '20px', marginTop: '16px' }}>
          {pending.map(r => <PendingRequest key={r._id} request={r} onDone={done} />)}
        </div>
      )}

      {approved.length > 0 && (
        <Card style={{ marginTop: '20px' }}>
          <h3 style={{ marginBottom: '12px' }}>Temporary managers</h3>
          {approved.map(r => {
            const active = new Date(r.startDate).getTime() <= now;
            return (
              <div key={r._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '10px 0', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                    {r.user?.firstName} {r.user?.lastName}
                    <span style={{ marginLeft: '8px', fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: active ? 'rgba(16,185,129,0.15)' : 'rgba(212,175,55,0.15)', color: active ? 'var(--accent-success)' : 'var(--accent-primary)' }}>
                      {active ? 'Active' : 'Scheduled'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>{windowText(r.startDate, r.endDate)}</div>
                </div>
                <Button variant="danger" onClick={() => revoke(r)} style={{ width: 'auto', padding: '6px 14px' }}>Revoke</Button>
              </div>
            );
          })}
        </Card>
      )}

      {showHistory && (
        <Card style={{ marginTop: '20px' }}>
          <h3 style={{ marginBottom: '12px' }}>Past requests</h3>
          {history === null ? <p>Loading…</p> : history.length === 0 ? <p style={{ fontSize: '0.9rem' }}>No past requests.</p> : history.map(r => (
            <div key={r._id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '8px 0', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ color: 'var(--text-primary)' }}>{r.user?.firstName} {r.user?.lastName}</span> · {windowText(r.startDate, r.endDate)}
                {r.reviewNote && <div>Note: {r.reviewNote}</div>}
              </div>
              <span style={{ whiteSpace: 'nowrap' }}>{r.status}{r.reviewedBy ? ` by ${r.reviewedBy.firstName}` : ''}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

export default ManagerAccessRequests;
