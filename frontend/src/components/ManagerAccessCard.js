import React, { useState, useEffect, useContext, useCallback } from 'react';
import Card from './Card';
import Button from './Button';
import { roleRequestApi } from '../utils/api';
import { AuthContext } from '../context/AuthContext';

const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' };

const DURATIONS = [
  { key: '7d', label: '1 week', days: 7 },
  { key: '14d', label: '2 weeks', days: 14 },
  { key: '1m', label: '1 month', months: 1 },
  { key: '3m', label: '3 months', months: 3 },
  { key: '6m', label: '6 months', months: 6 },
  { key: 'custom', label: 'Choose end date' },
  { key: 'none', label: 'No end date' }
];

const STATUS_STYLE = {
  Pending: ['rgba(245,158,11,0.15)', 'var(--accent-warning)'],
  Approved: ['rgba(16,185,129,0.15)', 'var(--accent-success)'],
  Rejected: ['rgba(239,68,68,0.15)', 'var(--accent-danger)'],
  Revoked: ['rgba(239,68,68,0.15)', 'var(--accent-danger)'],
  Cancelled: ['rgba(255,255,255,0.08)', 'var(--text-secondary)'],
  Ended: ['rgba(255,255,255,0.08)', 'var(--text-secondary)'],
  Expired: ['rgba(255,255,255,0.08)', 'var(--text-secondary)']
};

const pad = (n) => String(n).padStart(2, '0');
const toDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

// Last day of access for a preset duration, counting the start day as day one
const endForDuration = (start, duration) => {
  if (!start || !duration || (!duration.days && !duration.months)) return '';
  const d = fromDay(start);
  if (duration.days) d.setDate(d.getDate() + duration.days - 1);
  else { d.setMonth(d.getMonth() + duration.months); d.setDate(d.getDate() - 1); }
  return toDay(d);
};

// Dates from the server are whole UTC days
const formatDay = (date) => new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const formatInputDay = (s) => fromDay(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const windowText = (start, end) => (end ? `${formatDay(start)} – ${formatDay(end)}` : `From ${formatDay(start)}, no end date`);

const StatusPill = ({ status }) => {
  const [bg, color] = STATUS_STYLE[status] || STATUS_STYLE.Cancelled;
  return <span style={{ background: bg, color, padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{status}</span>;
};

const ManagerAccessCard = () => {
  const { refreshSession } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ startDate: toDay(new Date()), duration: '1m', endDate: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const load = useCallback(() => {
    return roleRequestApi.mine()
      .then(res => { if (res.data.success) setData(res.data); })
      .catch(() => setMsg({ text: 'Could not load your manager access requests.', type: 'error' }));
  }, []);

  useEffect(() => { load(); }, [load]);

  const duration = DURATIONS.find(d => d.key === form.duration);
  const endDate = form.duration === 'custom' ? form.endDate : form.duration === 'none' ? '' : endForDuration(form.startDate, duration);

  // Run an action, then reload this card and the session (the role may have changed)
  const run = async (action, successText) => {
    setBusy(true);
    setMsg({ text: '', type: '' });
    try {
      await action();
      await Promise.all([load(), refreshSession()]);
      setMsg({ text: successText, type: 'success' });
    } catch (err) {
      setMsg({ text: err.response?.data?.message || 'Something went wrong. Please try again.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.duration === 'custom' && !form.endDate) return setMsg({ text: 'Choose an end date.', type: 'error' });
    run(() => roleRequestApi.create({ startDate: form.startDate, endDate, reason: form.reason }), 'Request sent. The admins have been notified.');
  };

  if (!data) return null;
  // Only participants (and people with temporary access) use this card
  if (data.role !== 'Participant' && !data.access) return null;

  const pending = data.requests.find(r => r.status === 'Pending');
  const history = data.requests.filter(r => r !== pending && !(data.access && r.status === 'Approved')).slice(0, 5);

  return (
    <Card style={{ marginTop: '24px' }}>
      <h3 style={{ marginBottom: '6px' }}>Manager access</h3>
      <p style={{ fontSize: '0.9rem', marginBottom: '16px' }}>Need to run a yatra or manage accounts for a while? Ask the admins for manager access for as long as you need it.</p>

      {msg.text && (
        <p role={msg.type === 'error' ? 'alert' : 'status'} style={{
          color: msg.type === 'error' ? 'var(--accent-danger)' : 'var(--accent-success)',
          background: msg.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
          padding: '10px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.9rem'
        }}>{msg.text}</p>
      )}

      {data.access ? (
        <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '4px' }}>
            {data.access.active ? 'You have manager access' : 'Manager access approved'}
          </p>
          <p style={{ fontSize: '0.9rem', marginBottom: '12px' }}>
            {data.access.active
              ? (data.access.until ? `Until ${formatDay(data.access.until)}. After that your account goes back to participant access.` : 'No end date. It lasts until you end it or an admin does.')
              : `Starts ${formatDay(data.access.from)}${data.access.until ? ` and lasts until ${formatDay(data.access.until)}` : ', with no end date'}.`}
          </p>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => { if (window.confirm('End your manager access now? You will go back to participant access.')) run(() => roleRequestApi.endMyAccess(), 'Manager access ended.'); }}
            style={{ width: 'auto', padding: '8px 16px' }}
          >
            {data.access.active ? 'End access now' : 'Cancel access'}
          </Button>
        </div>
      ) : pending ? (
        <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
            <p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Request waiting for an admin</p>
            <StatusPill status="Pending" />
          </div>
          <p style={{ fontSize: '0.9rem' }}>{windowText(pending.startDate, pending.endDate)}</p>
          <p style={{ fontSize: '0.9rem', marginBottom: '12px', fontStyle: 'italic' }}>“{pending.reason}”</p>
          <Button variant="default" disabled={busy} onClick={() => run(() => roleRequestApi.cancel(pending._id), 'Request cancelled.')} style={{ width: 'auto', padding: '8px 16px' }}>Cancel request</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle} htmlFor="ma-start">Starting</label>
              <input id="ma-start" type="date" value={form.startDate} min={toDay(new Date())} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input-field" required />
            </div>
            <div>
              <label style={labelStyle} htmlFor="ma-duration">For</label>
              <select id="ma-duration" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="input-field">
                {DURATIONS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </div>
            {form.duration === 'custom' && (
              <div>
                <label style={labelStyle} htmlFor="ma-end">Until (last day)</label>
                <input id="ma-end" type="date" value={form.endDate} min={form.startDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="input-field" required />
              </div>
            )}
          </div>
          <p style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
            {form.startDate && (endDate ? `Access from ${formatInputDay(form.startDate)} through ${formatInputDay(endDate)}.` : form.duration === 'none' ? `Access from ${formatInputDay(form.startDate)} until you or an admin end it.` : '')}
          </p>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle} htmlFor="ma-reason">Why do you need it?</label>
            <textarea id="ma-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="input-field" rows="3" maxLength={1000} placeholder="e.g. I'm organising the Kartik yatra and need to add expenses and approve registrations" required />
          </div>
          <Button type="submit" disabled={busy} style={{ width: 'auto', padding: '10px 18px' }}>{busy ? 'Sending…' : 'Request manager access'}</Button>
        </form>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Past requests</h4>
          {history.map(r => (
            <div key={r._id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: 'var(--text-primary)' }}>{windowText(r.startDate, r.endDate)}</div>
                {r.reviewNote && <div style={{ color: 'var(--text-secondary)' }}>Admin note: {r.reviewNote}</div>}
              </div>
              <StatusPill status={r.status} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default ManagerAccessCard;
