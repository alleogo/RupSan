import React, { useState, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import { userApi } from '../utils/api';
import { AuthContext } from '../context/AuthContext';

const labelStyle = { display: 'block', marginBottom: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' };
const thStyle = { padding: '12px', color: 'var(--text-secondary)', fontWeight: '600', whiteSpace: 'nowrap' };
const tdStyle = { padding: '12px', verticalAlign: 'top' };

const STATUS_COLORS = {
  Approved: ['rgba(16,185,129,0.15)', 'var(--accent-success)'],
  Verified: ['rgba(16,185,129,0.15)', 'var(--accent-success)'],
  Pending: ['rgba(245,158,11,0.15)', 'var(--accent-warning)'],
  Rejected: ['rgba(239,68,68,0.15)', 'var(--accent-danger)'],
  Unverified: ['rgba(255,255,255,0.08)', 'var(--text-secondary)']
};

const ROLE_COLORS = {
  Admin: ['rgba(212,175,55,0.15)', 'var(--accent-primary)'],
  Manager: ['rgba(99,102,241,0.15)', '#a5b4fc'],
  Participant: ['rgba(255,255,255,0.08)', 'var(--text-primary)']
};

const Pill = ({ colors, children }) => (
  <span style={{ display: 'inline-block', background: colors[0], color: colors[1], padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', whiteSpace: 'nowrap' }}>
    {children}
  </span>
);

// The status that matters for each role: approval for managers, verification for participants
const userStatus = (u) => {
  if (u.role === 'Manager') return u.status;
  if (u.role === 'Participant') return u.verificationStatus;
  return null;
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Confirm a promotion (permanent or until a date) or a demotion, with an optional note for the user
const RoleChangeDialog = ({ target, onClose, onDone }) => {
  const promote = target.role !== 'Manager';
  const [duration, setDuration] = useState('permanent');
  const [until, setUntil] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const name = `${target.firstName} ${target.lastName}`;

  const submit = async (e) => {
    e.preventDefault();
    if (promote && duration === 'until' && !until) return setError('Choose the last day of manager access.');
    setBusy(true);
    setError('');
    try {
      const res = await userApi.changeRole(target._id, {
        role: promote ? 'Manager' : 'Participant',
        ...(promote && duration === 'until' ? { until } : {}),
        note
      });
      onDone(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change the role.');
      setBusy(false);
    }
  };

  // Portal to <body>: the page's fade-in animation would otherwise anchor this fixed overlay to the page
  return createPortal(
    <div onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px', backdropFilter: 'blur(4px)' }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-label={promote ? `Make ${name} a manager` : `Make ${name} a participant`} className="animate-fade-in" style={{ width: '100%', maxWidth: '460px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <h2 style={{ marginBottom: '8px' }}>{promote ? `Make ${name} a manager` : `Make ${name} a participant`}</h2>
        <p style={{ fontSize: '0.9rem', marginBottom: '16px' }}>
          {promote
            ? 'They can create and manage yatras, approve registrations and keep their own ledger.'
            : "They lose manager access right away. Yatras they created stay, and admins can still manage them. Their ledger entries are kept but hidden from them."}
        </p>

        {promote && (
          <div style={{ marginBottom: '16px' }}>
            {[['permanent', 'Permanently'], ['until', 'Until a date']].map(([value, label]) => (
              <label key={value} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input type="radio" name="duration" value={value} checked={duration === value} onChange={() => setDuration(value)} style={{ accentColor: 'var(--accent-primary)' }} />
                {label}
              </label>
            ))}
            {duration === 'until' && (
              <div style={{ marginLeft: '26px' }}>
                <label style={labelStyle} htmlFor="role-until">Last day of manager access</label>
                <input id="role-until" type="date" min={todayISO()} value={until} onChange={(e) => setUntil(e.target.value)} className="input-field" required />
              </div>
            )}
          </div>
        )}

        <label style={labelStyle} htmlFor="role-note">Note to {target.firstName} (optional, included in the email)</label>
        <textarea id="role-note" value={note} onChange={(e) => setNote(e.target.value)} className="input-field" rows="2" maxLength={1000} style={{ marginBottom: '16px' }} />

        {error && <p role="alert" style={{ color: 'var(--accent-danger)', fontSize: '0.9rem', marginBottom: '12px' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button type="button" variant="default" onClick={onClose} disabled={busy} style={{ flex: 1 }}>Cancel</Button>
          <Button type="submit" variant={promote ? 'primary' : 'danger'} disabled={busy} style={{ flex: 1 }}>
            {busy ? 'Saving…' : promote ? 'Make manager' : 'Make participant'}
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
};

const Users = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({ Admin: 0, Manager: 0, Participant: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState({ role: '', status: '', verificationStatus: '' });
  const [page, setPage] = useState(1);
  const [roleTarget, setRoleTarget] = useState(null);
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Wait for the admin to pause typing before searching
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!user || user.role !== 'Admin') {
      navigate('/');
      return;
    }
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const params = { page, limit: 20 };
        if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
        Object.entries(filters).forEach(([key, value]) => { if (value) params[key] = value; });

        const res = await userApi.getAll(params);
        if (res.data.success) {
          setUsers(res.data.users);
          setPagination(res.data.pagination);
          setCounts(res.data.counts);
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [user, navigate, debouncedSearch, filters, page, reloadKey]);

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setFilters({ role: '', status: '', verificationStatus: '' });
    setPage(1);
  };

  const hasFilters = search || filters.role || filters.status || filters.verificationStatus;
  const totalUsers = counts.Admin + counts.Manager + counts.Participant;

  return (
    <div className="animate-fade-in" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Users</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Search and filter everyone registered on the platform</p>
      </div>

      {notice && (
        <p role="status" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--accent-success)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.9rem' }}>✓ {notice}</p>
      )}

      {roleTarget && (
        <RoleChangeDialog
          target={roleTarget}
          onClose={() => setRoleTarget(null)}
          onDone={(message) => { setRoleTarget(null); setNotice(message); setReloadKey(k => k + 1); }}
        />
      )}

      {/* Role counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[['Total', totalUsers, ''], ['Participants', counts.Participant, 'Participant'], ['Managers', counts.Manager, 'Manager'], ['Admins', counts.Admin, 'Admin']].map(([label, count, role]) => (
          <button
            key={label}
            onClick={() => { setFilters({ ...filters, role }); setPage(1); }}
            style={{
              textAlign: 'left', cursor: 'pointer', padding: '16px 20px', borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              border: `1px solid ${filters.role === role ? 'var(--accent-primary)' : 'var(--border-color)'}`
            }}
          >
            <p style={{ fontSize: '0.85rem', marginBottom: '4px' }}>{label}</p>
            <p style={{ fontSize: '1.6rem', fontWeight: '700', color: filters.role === role ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{count}</p>
          </button>
        ))}
      </div>

      {/* Search and filters */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '12px', alignItems: 'end' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Search</label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, phone, centre or Aadhar"
              className="input-field"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Role</label>
            <select name="role" value={filters.role} onChange={handleFilterChange} className="input-field" style={{ width: '100%' }}>
              <option value="">All Roles</option>
              <option value="Participant">Participant</option>
              <option value="Manager">Manager</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Manager Approval</label>
            <select name="status" value={filters.status} onChange={handleFilterChange} className="input-field" style={{ width: '100%' }}>
              <option value="">Any</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Verification</label>
            <select name="verificationStatus" value={filters.verificationStatus} onChange={handleFilterChange} className="input-field" style={{ width: '100%' }}>
              <option value="">Any</option>
              <option value="Unverified">Unverified</option>
              <option value="Pending">Pending</option>
              <option value="Verified">Verified</option>
            </select>
          </div>

          <Button variant="default" onClick={clearFilters} disabled={!hasFilters} style={{ width: '100%' }}>Clear</Button>
        </div>
      </Card>

      {/* Results */}
      <Card>
        <p style={{ fontSize: '0.9rem', marginBottom: '12px' }}>
          {loading ? 'Loading users...' : `${pagination.total} user${pagination.total === 1 ? '' : 's'} found`}
        </p>

        {!loading && users.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '24px 0' }}>No users match your search.</p>
        ) : (
          <div className="table-scroll" style={{ overflowX: 'auto', opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
            <table className="stack-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Contact</th>
                  <th style={thStyle}>Centre</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Joined</th>
                  <th style={thStyle}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const status = userStatus(u);
                  return (
                    <tr key={u._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td data-label="" className="stack-title" style={{ ...tdStyle, fontWeight: '500' }}>{u.firstName} {u.lastName}</td>
                      <td data-label="Contact" style={tdStyle}>
                        <div>
                          <div style={{ overflowWrap: 'anywhere' }}>{u.email}</div>
                          {u.phoneNumber && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{u.phoneNumber}</div>}
                        </div>
                      </td>
                      <td data-label="Centre" style={{ ...tdStyle, color: u.centre ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{u.centre || '—'}</td>
                      <td data-label="Role" style={tdStyle}><Pill colors={ROLE_COLORS[u.role] || ROLE_COLORS.Participant}>{u.role}</Pill></td>
                      <td data-label="Status" style={tdStyle}>
                        <div>
                          {status ? <Pill colors={STATUS_COLORS[status] || STATUS_COLORS.Unverified}>{status}</Pill> : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                          {u.tempManagerFrom && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', whiteSpace: 'nowrap' }}>
                              {u.role === 'Manager' ? 'Temporary manager' : 'Manager from ' + new Date(u.tempManagerFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                              {u.tempManagerUntil ? ` · until ${new Date(u.tempManagerUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}` : ' · no end date'}
                            </div>
                          )}
                        </div>
                      </td>
                      <td data-label="Joined" style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                      <td data-label="" style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {u.role !== 'Admin' && u._id !== (user?._id || user?.id) && (
                          <button
                            type="button"
                            onClick={() => setRoleTarget(u)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: '4px 6px', color: u.role === 'Manager' ? 'var(--accent-danger)' : 'var(--accent-primary)' }}
                          >
                            {u.role === 'Manager' ? 'Make participant' : 'Make manager'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '20px' }}>
            <Button variant="default" onClick={() => setPage(p => p - 1)} disabled={page <= 1 || loading} style={{ width: 'auto', padding: '8px 16px' }}>← Previous</Button>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Page {pagination.page} of {pagination.totalPages}</span>
            <Button variant="default" onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages || loading} style={{ width: 'auto', padding: '8px 16px' }}>Next →</Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Users;
