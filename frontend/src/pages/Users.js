import React, { useState, useEffect, useContext } from 'react';
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
  }, [user, navigate, debouncedSearch, filters, page]);

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
                      <td data-label="Status" style={tdStyle}>{status ? <Pill colors={STATUS_COLORS[status] || STATUS_COLORS.Unverified}>{status}</Pill> : <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>
                      <td data-label="Joined" style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
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
