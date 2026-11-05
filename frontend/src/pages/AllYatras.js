import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import { yatraApi, centreApi } from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { visibilityLabel } from '../utils/yatraAccess';

// Super Admin: every yatra on the platform, with search, filters and paging

const EMPTY = { status: '', centreId: '', from: '', to: '', sort: 'startDate:desc' };
const labelStyle = { display: 'block', marginBottom: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' };
const th = { padding: '12px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'left' };
const td = { padding: '12px', verticalAlign: 'top' };
const STATUS_COLORS = {
  Upcoming: ['rgba(212,175,55,0.15)', 'var(--accent-primary)'],
  Ongoing: ['rgba(16,185,129,0.15)', 'var(--accent-success)'],
  Completed: ['rgba(255,255,255,0.08)', 'var(--text-secondary)']
};
const formatDay = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const AllYatras = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [centres, setCentres] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'SuperAdmin') { navigate('/'); return; }
    centreApi.list().then(res => setCentres(res.data.centres)).catch(() => {});
  }, [user, navigate]);

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!user || user.role !== 'SuperAdmin') return;
    const [sortBy, order] = filters.sort.split(':');
    const params = { page, limit: 20, sortBy, order };
    if (debouncedSearch) params.search = debouncedSearch;
    ['status', 'centreId', 'from', 'to'].forEach(k => { if (filters[k]) params[k] = filters[k]; });
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    yatraApi.search(params)
      .then(res => { if (!cancelled) setData(res.data); })
      .catch(err => { if (!cancelled) setLoadError(err.response?.data?.message || 'Could not load yatras.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, debouncedSearch, filters, page]);

  const setFilter = (key, value) => { setFilters(f => ({ ...f, [key]: value })); setPage(1); };
  const hasFilters = search || filters.status || filters.centreId || filters.from || filters.to;
  const counts = data?.counts || { Upcoming: 0, Ongoing: 0, Completed: 0 };

  return (
    <div className="animate-fade-in" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>All Yatras</h1>
      <p style={{ marginBottom: '24px' }}>Every yatra across all centres.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: '16px', marginBottom: '20px' }}>
        {['Upcoming', 'Ongoing', 'Completed'].map(status => (
          <button key={status} type="button" onClick={() => setFilter('status', filters.status === status ? '' : status)} style={{
            textAlign: 'left', cursor: 'pointer', padding: '16px 20px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            border: `1px solid ${filters.status === status ? 'var(--accent-primary)' : 'var(--border-color)'}`
          }}>
            <p style={{ fontSize: '0.85rem', marginBottom: '4px' }}>{status}</p>
            <p style={{ fontSize: '1.6rem', fontWeight: 700 }}>{data ? counts[status] : '…'}</p>
          </button>
        ))}
      </div>

      <Card style={{ marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: '12px', alignItems: 'end' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle} htmlFor="yatra-search">Search</label>
            <input id="yatra-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field" placeholder="Title, destination or description" />
          </div>
          <div>
            <label style={labelStyle} htmlFor="yatra-centre">Centre</label>
            <select id="yatra-centre" value={filters.centreId} onChange={(e) => setFilter('centreId', e.target.value)} className="input-field">
              <option value="">All centres</option>
              {centres.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              <option value="none">No centre (older yatras)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="yatra-status">Status</label>
            <select id="yatra-status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className="input-field">
              <option value="">Any</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="yatra-from">Between</label>
            <input id="yatra-from" type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} className="input-field" />
          </div>
          <div>
            <label style={labelStyle} htmlFor="yatra-to">and</label>
            <input id="yatra-to" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} className="input-field" />
          </div>
          <div>
            <label style={labelStyle} htmlFor="yatra-sort">Sort by</label>
            <select id="yatra-sort" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} className="input-field">
              <option value="startDate:desc">Start date, latest first</option>
              <option value="startDate:asc">Start date, earliest first</option>
              <option value="createdAt:desc">Recently created</option>
              <option value="title:asc">Title A–Z</option>
              <option value="registrationFee:desc">Fee, highest first</option>
            </select>
          </div>
          <Button variant="default" onClick={() => { setSearch(''); setFilters(EMPTY); setPage(1); }} disabled={!hasFilters} style={{ width: '100%' }}>Clear</Button>
        </div>
      </Card>

      <Card>
        {loadError ? (
          <div role="alert" style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ color: 'var(--accent-danger)' }}>{loadError}</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '0.9rem', marginBottom: '12px' }}>
              {loading && !data ? 'Loading yatras…' : `${data?.pagination.total ?? 0} yatra${data?.pagination.total === 1 ? '' : 's'} found`}
            </p>
            {data && data.yatras.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '24px 0' }}>No yatras match these filters.</p>
            ) : data && (
              <div className="table-scroll" style={{ overflowX: 'auto', opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
                <table className="stack-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <th style={th}>Yatra</th>
                      <th style={th}>Centre</th>
                      <th style={th}>Visible to</th>
                      <th style={th}>Dates</th>
                      <th style={th}>Status</th>
                      <th style={{ ...th, textAlign: 'right' }}>Fee</th>
                      <th style={th}>Manager</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.yatras.map(y => {
                      const [bg, color] = STATUS_COLORS[y.status] || STATUS_COLORS.Completed;
                      return (
                        <tr key={y._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td data-label="" className="stack-title" style={td}>
                            <Link to={`/yatra/${y._id}`} style={{ color: 'var(--text-primary)', fontWeight: 500, textDecoration: 'none' }}>{y.title}</Link>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>📍 {y.destination}</div>
                          </td>
                          <td data-label="Centre" style={{ ...td, color: y.centre ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{y.centre?.name || '—'}</td>
                          <td data-label="Visible to" style={{ ...td, fontSize: '0.9rem' }}>{visibilityLabel(y)}</td>
                          <td data-label="Dates" style={{ ...td, whiteSpace: 'nowrap', fontSize: '0.9rem' }}>{formatDay(y.startDate)} – {formatDay(y.endDate)}</td>
                          <td data-label="Status" style={td}><span style={{ background: bg, color, padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>{y.status}</span></td>
                          <td data-label="Fee" style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>₹{Number(y.registrationFee || 0).toLocaleString('en-IN')}</td>
                          <td data-label="Manager" style={{ ...td, fontSize: '0.9rem' }}>{y.createdBy ? `${y.createdBy.firstName} ${y.createdBy.lastName}` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {data && data.pagination.pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '20px' }}>
                <Button variant="default" onClick={() => setPage(p => p - 1)} disabled={page <= 1 || loading} style={{ width: 'auto', padding: '8px 16px' }}>← Previous</Button>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Page {data.pagination.page} of {data.pagination.pages}</span>
                <Button variant="default" onClick={() => setPage(p => p + 1)} disabled={page >= data.pagination.pages || loading} style={{ width: 'auto', padding: '8px 16px' }}>Next →</Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default AllYatras;
