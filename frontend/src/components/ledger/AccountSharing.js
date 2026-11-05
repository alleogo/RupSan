import React, { useState, useEffect, useCallback } from 'react';
import Card from '../Card';
import Button from '../Button';
import { accountAccessApi, userApi } from '../../utils/api';
import { labelStyle, today } from './ledgerUtils';

// Centre admins: share the account with members of the centre (Viewer or Editor, optionally until a date)
const AccountSharing = ({ centreName, onChanged }) => {
  const [grants, setGrants] = useState(null);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ userId: '', level: 'Viewer', expiresOn: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    accountAccessApi.list().then(res => setGrants(res.data.grants)).catch(err => setError(err.response?.data?.message || 'Could not load sharing.'));
  }, []);

  useEffect(() => {
    load();
    userApi.getAll({ limit: 100 }).then(res => setMembers(res.data.users.filter(u => u.role === 'Participant' || u.role === 'Manager'))).catch(() => {});
  }, [load]);

  const share = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await accountAccessApi.grant(form.userId, form.level, form.expiresOn || undefined);
      setForm({ userId: '', level: 'Viewer', expiresOn: '' });
      onChanged(res.data.message);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not share the account.');
    }
    setBusy(false);
  };

  const revoke = async (g) => {
    if (!window.confirm(`Remove ${g.user?.firstName}'s access to the account?`)) return;
    try {
      const res = await accountAccessApi.revoke(g.user._id);
      onChanged(res.data.message);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not remove access.');
    }
  };

  const now = Date.now();
  return (
    <Card>
      <h3 style={{ marginBottom: '4px' }}>Sharing</h3>
      <p style={{ fontSize: '0.9rem', marginBottom: '16px' }}>
        You and your co-admins have full access to the {centreName} account. You can also share it with members of your centre:
        a <strong>Viewer</strong> sees entries and reports; an <strong>Editor</strong> can also add entries and edit or delete their own.
      </p>

      <form onSubmit={share} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: '12px', alignItems: 'end', marginBottom: '20px' }}>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle} htmlFor="share-member">Member</label>
          <select id="share-member" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="input-field" required>
            <option value="">Choose a member</option>
            {members.map(m => <option key={m._id} value={m._id}>{m.firstName} {m.lastName} ({m.role})</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="share-level">Access</label>
          <select id="share-level" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="input-field">
            <option value="Viewer">Viewer</option>
            <option value="Editor">Editor</option>
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="share-until">Until (optional)</label>
          <input id="share-until" type="date" min={today()} value={form.expiresOn} onChange={(e) => setForm({ ...form, expiresOn: e.target.value })} className="input-field" />
        </div>
        <Button type="submit" disabled={busy || !form.userId} style={{ width: '100%' }}>{busy ? 'Sharing…' : 'Share'}</Button>
      </form>
      {error && <p role="alert" style={{ color: 'var(--accent-danger)', fontSize: '0.9rem', marginBottom: '12px' }}>{error}</p>}

      {!grants ? <p>Loading…</p> : grants.length === 0 ? <p style={{ fontSize: '0.9rem' }}>Not shared with anyone yet.</p> : grants.map(g => {
        const expired = g.expiresAt && new Date(g.expiresAt).getTime() <= now;
        return (
          <div key={g._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '10px 0', borderTop: '1px solid var(--border-color)', opacity: expired ? 0.6 : 1 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--text-primary)' }}>{g.user ? `${g.user.firstName} ${g.user.lastName}` : 'Former member'} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>· {g.level}</span></div>
              <div style={{ fontSize: '0.8rem', color: expired ? 'var(--accent-warning)' : 'var(--text-secondary)' }}>
                {g.expiresAt ? `${expired ? 'Ended' : 'Until'} ${new Date(g.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}` : 'No end date'}
                {g.grantedBy ? ` · shared by ${g.grantedBy.firstName}` : ''}
              </div>
            </div>
            {g.user && <button type="button" onClick={() => revoke(g)} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Remove</button>}
          </div>
        );
      })}
    </Card>
  );
};

export default AccountSharing;
