import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import TransactionForm from '../components/ledger/TransactionForm';
import MonthlyView from '../components/ledger/MonthlyView';
import BreakdownView from '../components/ledger/BreakdownView';
import EntryHistory from '../components/ledger/EntryHistory';
import DeletedEntries from '../components/ledger/DeletedEntries';
import AccountSharing from '../components/ledger/AccountSharing';
import UnassignedEntries from '../components/ledger/UnassignedEntries';
import { transactionApi, yatraApi, getMediaUrl, accountAccessApi } from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import {
  formatINR, PAYMENT_TYPES, ONLINE_METHODS, PERIOD_PRESETS, periodParams, periodLabel, toMonth, labelStyle, pillStyle
} from '../components/ledger/ledgerUtils';

const EMPTY_FILTERS = { type: '', category: '', paymentType: '', paymentMethod: '', yatra: '', minAmount: '', maxAmount: '', hasProof: '' };

const th = { padding: '12px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'left' };
const td = { padding: '12px', verticalAlign: 'top' };
const linkButton = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: '4px 6px' };
const amountColor = (n) => (n > 0 ? 'var(--accent-success)' : n < 0 ? 'var(--accent-danger)' : 'var(--text-primary)');

const StatTile = ({ label, value, sub, color }) => (
  <Card style={{ padding: '18px 20px' }}>
    <p style={{ fontSize: '0.85rem', marginBottom: '6px' }}>{label}</p>
    <p style={{ fontSize: '1.7rem', fontWeight: 700, color: color || 'var(--text-primary)', lineHeight: 1.2 }}>{value}</p>
    {sub && <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>{sub}</p>}
  </Card>
);

const Insight = ({ label, value }) => (
  <div style={{ minWidth: 0 }}>
    <p style={{ fontSize: '0.78rem', marginBottom: '2px' }}>{label}</p>
    <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
  </div>
);

// Column header that toggles sorting on that field
const SortHeader = ({ field, label, sort, onSort, align = 'left' }) => {
  const active = sort.sortBy === field;
  return (
    <th style={{ ...th, textAlign: align }} aria-sort={active ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(field)} style={{ background: 'none', border: 'none', color: active ? 'var(--accent-primary)' : 'inherit', font: 'inherit', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
        {label} {active ? (sort.order === 'asc' ? '↑' : '↓') : ''}
      </button>
    </th>
  );
};

const Ledger = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [tab, setTab] = useState('transactions');
  const [period, setPeriod] = useState({ preset: 'all', month: toMonth(new Date()), startDate: '', endDate: '' });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState({ sortBy: 'date', order: 'desc' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [categories, setCategories] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [yatras, setYatras] = useState([]);

  const [selected, setSelected] = useState({}); // id -> entry, so selection maths survives paging
  const [form, setForm] = useState(null); // { transaction } while the add/edit form is open
  const [notice, setNotice] = useState('');
  const [exporting, setExporting] = useState(false);
  const [historyEntry, setHistoryEntry] = useState(null);

  // What this user can do with the account; the Super Admin chooses which centre's account to view
  const [access, setAccess] = useState(null);
  const [accessError, setAccessError] = useState('');
  const [accountCentreId, setAccountCentreId] = useState('');
  const isSuperAdmin = user?.role === 'SuperAdmin';
  const perms = access?.permissions || {};
  const ready = Boolean(perms.canView) && (!isSuperAdmin || Boolean(accountCentreId));
  const accountName = isSuperAdmin ? (access?.centres || []).find(c => c._id === accountCentreId)?.name : access?.centre?.name;

  // Wait for typing to pause before searching
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Filters shared by every tab (the monthly tab chooses its own year instead of the period)
  const filterParams = useMemo(() => {
    const params = {};
    if (isSuperAdmin && accountCentreId) params.centreId = accountCentreId;
    if (debouncedSearch) params.search = debouncedSearch;
    Object.entries(filters).forEach(([key, value]) => { if (value !== '') params[key] = value; });
    return params;
  }, [debouncedSearch, filters, isSuperAdmin, accountCentreId]);

  const queryParams = useMemo(() => ({ ...periodParams(period), ...filterParams }), [period, filterParams]);
  const queryKey = JSON.stringify(queryParams);

  // A new query starts at page 1 with nothing selected
  useEffect(() => {
    setPage(1);
    setSelected({});
  }, [queryKey]);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    accountAccessApi.me()
      .then(res => {
        setAccess(res.data);
        if (res.data.centres?.length) setAccountCentreId(id => id || res.data.centres[0]._id);
      })
      .catch(err => setAccessError(err.response?.data?.message || 'Could not load your account access.'));
    yatraApi.getAll().then(res => { if (res.data.success) setYatras(res.data.yatras); }).catch(() => {});
  }, [user, navigate]);

  useEffect(() => {
    if (!ready) return;
    transactionApi.getCategories(isSuperAdmin ? { centreId: accountCentreId } : undefined)
      .then(res => {
        if (!res.data.success) return;
        setCategories(res.data.categories);
        setPaymentMethods(res.data.paymentMethods || []);
      })
      .catch(() => {});
  }, [refreshKey, ready, isSuperAdmin, accountCentreId]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    transactionApi.getAll({ ...JSON.parse(queryKey), ...sort, page, limit })
      .then(res => {
        if (cancelled || !res.data.success) return;
        // After deleting the last entries on a page, step back to the new last page
        if (res.data.transactions.length === 0 && page > 1 && res.data.pagination.total > 0) {
          setPage(res.data.pagination.pages);
          return;
        }
        setTransactions(res.data.transactions);
        // Keep ticked entries in sync with the latest data so the selection maths stays correct
        setSelected(s => {
          const fresh = res.data.transactions.filter(t => s[t._id]);
          if (!fresh.length) return s;
          const next = { ...s };
          fresh.forEach(t => { next[t._id] = t; });
          return next;
        });
        setStats(res.data.stats);
        setPagination(res.data.pagination);
      })
      .catch(err => console.error('Failed to fetch transactions:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ready, queryKey, sort, page, limit, refreshKey]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }));
  const activeFilterCount = Object.values(filters).filter(v => v !== '').length + (debouncedSearch ? 1 : 0);
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setSearch(''); };

  const handleSort = (field) => setSort(s => ({ sortBy: field, order: s.sortBy === field && s.order === 'desc' ? 'asc' : 'desc' }));

  const refresh = (message) => {
    setRefreshKey(k => k + 1);
    if (message) setNotice(message);
  };

  const handleSaved = (saved) => {
    const wasEdit = Boolean(form?.transaction);
    setForm(null);
    if (saved) setSelected(s => (s[saved._id] ? { ...s, [saved._id]: saved } : s));
    refresh(wasEdit ? 'Entry updated' : 'Entry added');
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`Delete "${t.description}" (${formatINR(t.amount)})? This cannot be undone.`)) return;
    try {
      await transactionApi.delete(t._id);
      setSelected(s => { const next = { ...s }; delete next[t._id]; return next; });
      refresh('Entry deleted');
    } catch (err) {
      alert(err.response?.data?.message || 'Could not delete the entry.');
    }
  };

  const selectedList = Object.values(selected);
  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedList.length} selected entr${selectedList.length === 1 ? 'y' : 'ies'}? This cannot be undone.`)) return;
    try {
      const res = await transactionApi.bulkDelete(selectedList.map(t => t._id));
      setSelected({});
      refresh(res.data.message);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not delete the selected entries.');
    }
  };

  const toggleSelect = (t) => setSelected(s => {
    const next = { ...s };
    if (next[t._id]) delete next[t._id]; else next[t._id] = t;
    return next;
  });
  const pageAllSelected = transactions.length > 0 && transactions.every(t => selected[t._id]);
  const togglePage = () => setSelected(s => {
    const next = { ...s };
    transactions.forEach(t => { if (pageAllSelected) delete next[t._id]; else next[t._id] = t; });
    return next;
  });

  // Maths over the ticked entries
  const selection = useMemo(() => {
    const income = selectedList.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const expense = selectedList.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0);
    const amounts = selectedList.map(t => t.amount);
    return {
      count: selectedList.length,
      income,
      expense,
      net: income - expense,
      sum: amounts.reduce((a, b) => a + b, 0),
      avg: amounts.length ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0,
      min: amounts.length ? Math.min(...amounts) : 0,
      max: amounts.length ? Math.max(...amounts) : 0
    };
  }, [selectedList]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await transactionApi.exportCsv({ ...queryParams, ...sort });
      if (res.headers['x-export-truncated'] === 'true') {
        alert(`Only the first 10,000 of ${Number(res.headers['x-total-count']).toLocaleString('en-IN')} entries were exported. Narrow the period or filters to export the rest.`);
      }
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ledger-${periodLabel(period).replace(/[^\w]+/g, '-').toLowerCase()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Could not export the entries.');
    } finally {
      setExporting(false);
    }
  };

  // Jump from the monthly / breakdown tabs to the matching entries
  const showMonth = (month) => {
    setPeriod(p => ({ ...p, preset: 'month', month }));
    setTab('transactions');
  };
  const showCategory = (category, type) => {
    setFilters(f => ({ ...f, category, type }));
    setShowFilters(true);
    setTab('transactions');
  };

  const income = stats?.income || { total: 0, count: 0, avg: 0, min: 0, max: 0 };
  const expense = stats?.expense || { total: 0, count: 0, avg: 0, min: 0, max: 0 };
  const net = stats?.net || 0;
  const periodName = periodLabel(period);
  const userId = String(user?._id || user?.id);
  const canChange = (t) => perms.canEditAll || (perms.canEditOwn && String(t.recordedBy?._id || t.recordedBy) === userId);
  const levelText = {
    Admin: 'Full access (admin)',
    Editor: 'Editor: you can add entries and change your own',
    Viewer: 'View only',
    SuperAdmin: 'View only (Super Admin): you can restore deleted entries'
  }[perms.level];

  const pageMessage = (title, text, action) => (
    <div className="animate-fade-in" style={{ padding: '24px', maxWidth: '700px', margin: '40px auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.6rem', marginBottom: '8px' }}>{title}</h1>
      <p style={{ marginBottom: action ? '20px' : 0 }}>{text}</p>
      {action && <Link to={action.to} className="btn btn-primary" style={{ display: 'inline-block', width: 'auto', padding: '10px 20px', textDecoration: 'none' }}>{action.label}</Link>}
    </div>
  );
  if (accessError) return pageMessage('Ledger', accessError);
  if (!access) return pageMessage('Ledger', 'Loading…');
  if (isSuperAdmin && !(access.centres || []).length) {
    return pageMessage('No centre accounts yet', 'Each centre has its own account. Add your centres first, then come back here to view their accounts and move older ledger entries into them.', { to: '/centres', label: 'Go to Centres' });
  }
  if (!perms.canView) {
    const hasCentre = Boolean(user?.centreId);
    if (user?.role === 'Admin' && !hasCentre) return pageMessage('Not assigned to a centre yet', "Each centre has its own account. Once the Super Admin makes you a centre's admin, its account will appear here.");
    if (!hasCentre) return pageMessage('Choose your centre first', "Each centre has its own account. Choose your centre on your profile; its admin can then share the account with you.", { to: '/profile', label: 'Go to Profile' });
    return pageMessage('No account access', "You don't have access to your centre's account. Your centre's admin can share it with you.");
  }

  return (
    <div className="animate-fade-in" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', paddingBottom: selectedList.length ? '180px' : '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>{accountName ? `${accountName} Account` : 'Ledger'}</h1>
          <p>{levelText}{perms.expiresAt ? ` · until ${new Date(perms.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}` : ''}</p>
          {isSuperAdmin && (
            <select value={accountCentreId} onChange={(e) => { setAccountCentreId(e.target.value); setTab(t => (t === 'sharing' ? 'transactions' : t)); }} className="input-field" style={{ width: 'auto', marginTop: '12px', padding: '8px 12px' }} aria-label="Centre account">
              {(access.centres || []).map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Button variant="default" onClick={handleExport} disabled={exporting || !pagination.total} style={{ width: 'auto', padding: '10px 18px' }}>
            {exporting ? 'Exporting…' : '⬇ Export CSV'}
          </Button>
          {perms.canAdd && <Button onClick={() => setForm({ transaction: null })} style={{ width: 'auto', padding: '10px 18px' }}>+ Add Entry</Button>}
        </div>
      </div>

      {isSuperAdmin && <UnassignedEntries centres={access.centres || []} onMoved={(message) => refresh(message)} />}

      {notice && (
        <div role="status" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--accent-success)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.9rem' }}>
          ✓ {notice}
        </div>
      )}

      {/* Period */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
        {PERIOD_PRESETS.map(p => (
          <button key={p.key} type="button" onClick={() => setPeriod(prev => ({ ...prev, preset: p.key }))} style={pillStyle(period.preset === p.key)}>
            {p.label}
          </button>
        ))}
        {period.preset === 'month' && (
          <input type="month" value={period.month} onChange={(e) => setPeriod(p => ({ ...p, month: e.target.value }))} className="input-field" style={{ width: 'auto', padding: '7px 10px' }} aria-label="Month" />
        )}
        {period.preset === 'custom' && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={period.startDate} onChange={(e) => setPeriod(p => ({ ...p, startDate: e.target.value }))} className="input-field" style={{ width: 'auto', padding: '7px 10px' }} aria-label="From" />
            <span style={{ color: 'var(--text-secondary)' }}>to</span>
            <input type="date" value={period.endDate} onChange={(e) => setPeriod(p => ({ ...p, endDate: e.target.value }))} className="input-field" style={{ width: 'auto', padding: '7px 10px' }} aria-label="To" />
          </div>
        )}
      </div>

      {/* Totals for the period and filters */}
      <div style={{ opacity: loading && stats ? 0.6 : 1, transition: 'opacity 0.15s' }}>
        <div className="ledger-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '16px', marginBottom: '16px' }}>
          <StatTile label="Income" value={formatINR(income.total)} sub={`${income.count} entr${income.count === 1 ? 'y' : 'ies'}`} color="var(--accent-success)" />
          <StatTile label="Expenses" value={formatINR(expense.total)} sub={`${expense.count} entr${expense.count === 1 ? 'y' : 'ies'}`} color="var(--accent-danger)" />
          <StatTile label="Net balance" value={formatINR(net, { signed: true })} sub={periodName} color={amountColor(net)} />
          <StatTile
            label="Savings rate"
            value={income.total > 0 ? `${((net / income.total) * 100).toFixed(1)}%` : '—'}
            sub={income.total > 0 ? `Spent ${((expense.total / income.total) * 100).toFixed(1)}% of income` : 'No income in this period'}
          />
        </div>

        <Card style={{ padding: '16px 20px', marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '16px' }}>
            <Insight label="Average income" value={income.count ? formatINR(income.avg) : '—'} />
            <Insight label="Largest income" value={income.count ? formatINR(income.max) : '—'} />
            <Insight label="Average expense" value={expense.count ? formatINR(expense.avg) : '—'} />
            <Insight label="Largest expense" value={expense.count ? formatINR(expense.max) : '—'} />
            <Insight label="Smallest expense" value={expense.count ? formatINR(expense.min) : '—'} />
            <Insight label="Total entries" value={stats?.count ?? 0} />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="tab-row" role="tablist" style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[['transactions', 'Transactions'], ['monthly', 'Monthly'], ['breakdown', 'Breakdown'], ...(perms.canRestore ? [['deleted', 'Deleted']] : []), ...(perms.canShare ? [['sharing', 'Sharing']] : [])].map(([key, label]) => (
          <Button key={key} role="tab" aria-selected={tab === key} variant={tab === key ? 'primary' : 'default'} onClick={() => setTab(key)} style={{ width: 'auto' }}>{label}</Button>
        ))}
      </div>

      {/* Search and filters apply to every tab */}
      <Card style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description, party, category, payment ID, notes or amount"
            className="input-field"
            style={{ flex: '1 1 260px', width: 'auto' }}
            aria-label="Search entries"
          />
          <Button variant="default" onClick={() => setShowFilters(s => !s)} aria-expanded={showFilters} style={{ width: 'auto', padding: '10px 16px' }}>
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ''} {showFilters ? '▴' : '▾'}
          </Button>
          {activeFilterCount > 0 && (
            <button type="button" onClick={clearFilters} style={{ ...linkButton, color: 'var(--accent-primary)' }}>Clear all</button>
          )}
        </div>

        {showFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: '12px', marginTop: '16px' }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={filters.type} onChange={(e) => setFilter('type', e.target.value)} className="input-field">
                <option value="">Income &amp; expense</option>
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={filters.category} onChange={(e) => setFilter('category', e.target.value)} className="input-field">
                <option value="">All categories</option>
                {[...new Set([...categories, filters.category].filter(Boolean))].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Payment type</label>
              <select value={filters.paymentType} onChange={(e) => setFilter('paymentType', e.target.value)} className="input-field">
                <option value="">Any</option>
                {PAYMENT_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Payment method</label>
              <select value={filters.paymentMethod} onChange={(e) => setFilter('paymentMethod', e.target.value)} className="input-field">
                <option value="">Any</option>
                {[...new Set([...ONLINE_METHODS, ...paymentMethods])].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Yatra</label>
              <select value={filters.yatra} onChange={(e) => setFilter('yatra', e.target.value)} className="input-field">
                <option value="">Any</option>
                {yatras.map(y => <option key={y._id} value={y._id}>{y.title}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Payment proof</label>
              <select value={filters.hasProof} onChange={(e) => setFilter('hasProof', e.target.value)} className="input-field">
                <option value="">Any</option>
                <option value="yes">With proof</option>
                <option value="no">Without proof</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Min amount (₹)</label>
              <input type="number" min="0" inputMode="decimal" value={filters.minAmount} onChange={(e) => setFilter('minAmount', e.target.value)} className="input-field" placeholder="0" />
            </div>
            <div>
              <label style={labelStyle}>Max amount (₹)</label>
              <input type="number" min="0" inputMode="decimal" value={filters.maxAmount} onChange={(e) => setFilter('maxAmount', e.target.value)} className="input-field" placeholder="Any" />
            </div>
            <div>
              <label style={labelStyle}>Sort by</label>
              <select value={`${sort.sortBy}:${sort.order}`} onChange={(e) => { const [sortBy, order] = e.target.value.split(':'); setSort({ sortBy, order }); }} className="input-field">
                <option value="date:desc">Newest first</option>
                <option value="date:asc">Oldest first</option>
                <option value="amount:desc">Amount: high to low</option>
                <option value="amount:asc">Amount: low to high</option>
                <option value="category:asc">Category A–Z</option>
                <option value="party:asc">Party A–Z</option>
                <option value="createdAt:desc">Recently added</option>
              </select>
            </div>
          </div>
        )}
      </Card>

      {tab === 'monthly' && <MonthlyView key={refreshKey} filterParams={filterParams} onSelectMonth={showMonth} />}
      {tab === 'deleted' && perms.canRestore && <DeletedEntries key={refreshKey} params={isSuperAdmin ? { centreId: accountCentreId } : {}} onRestored={(message) => refresh(message)} />}
      {tab === 'sharing' && perms.canShare && <AccountSharing centreName={accountName} onChanged={(message) => setNotice(message)} />}
      {tab === 'breakdown' && <BreakdownView key={refreshKey} filterParams={queryParams} periodName={periodName} onSelectCategory={showCategory} />}

      {tab === 'transactions' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <p style={{ fontSize: '0.9rem' }}>
              {loading && !transactions.length ? 'Loading entries…' : `${pagination.total} entr${pagination.total === 1 ? 'y' : 'ies'} · ${periodName}`}
            </p>
            {transactions.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={pageAllSelected} onChange={togglePage} style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }} />
                Select page
              </label>
            )}
          </div>

          {!loading && transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              {activeFilterCount > 0 || period.preset !== 'all' ? (
                <>
                  <p style={{ marginBottom: '12px' }}>No entries match these filters for {periodName}.</p>
                  <button type="button" onClick={() => { clearFilters(); setPeriod(p => ({ ...p, preset: 'all' })); }} style={{ ...linkButton, color: 'var(--accent-primary)' }}>Show all entries</button>
                </>
              ) : (
                <>
                  <p style={{ marginBottom: '16px' }}>No entries yet.{perms.canAdd ? ' Record your first income or expense.' : ''}</p>
                  {perms.canAdd && <Button onClick={() => setForm({ transaction: null })} style={{ width: 'auto', padding: '10px 18px' }}>+ Add Entry</Button>}
                </>
              )}
            </div>
          ) : (
            <div className="table-scroll" style={{ overflowX: 'auto', opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
              <table className="stack-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ ...th, width: '36px' }}><span className="sr-only">Select</span></th>
                    <SortHeader field="date" label="Date" sort={sort} onSort={handleSort} />
                    <th style={th}>Details</th>
                    <SortHeader field="category" label="Category" sort={sort} onSort={handleSort} />
                    <th style={th}>Payment</th>
                    <SortHeader field="amount" label="Amount" sort={sort} onSort={handleSort} align="right" />
                    <th style={{ ...th, textAlign: 'right' }}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => {
                    const isIncome = t.type === 'Income';
                    return (
                      <tr key={t._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: selected[t._id] ? 'rgba(212,175,55,0.06)' : 'transparent' }}>
                        <td data-label="Select" style={td}>
                          <input type="checkbox" checked={Boolean(selected[t._id])} onChange={() => toggleSelect(t)} aria-label={`Select ${t.description}`} style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }} />
                        </td>
                        <td data-label="Date" style={{ ...td, whiteSpace: 'nowrap' }}>
                          {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                        </td>
                        <td data-label="" className="stack-title" style={{ ...td, minWidth: '220px' }}>
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{t.description}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 400 }}>
                            {t.party && <span>{isIncome ? 'From' : 'To'} {t.party}</span>}
                            {t.yatra?.title && <span>{t.party ? ' · ' : ''}Yatra: {t.yatra.title}</span>}
                          </div>
                          {t.notes && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', fontStyle: 'italic', fontWeight: 400 }}>{t.notes}</div>}
                        </td>
                        <td data-label="Category" style={{ ...td, fontSize: '0.9rem' }}>{t.category}</td>
                        <td data-label="Payment" style={{ ...td, fontSize: '0.9rem' }}>
                          <div>
                            <div style={{ whiteSpace: 'nowrap' }}>{t.paymentType || 'Cash'}{t.paymentMethod ? ` · ${t.paymentMethod}` : ''}</div>
                            {t.paymentId && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', overflowWrap: 'anywhere' }}>{t.paymentId}</div>}
                            {t.paymentProof && <a href={getMediaUrl(t.paymentProof)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}>📎 Proof</a>}
                          </div>
                        </td>
                        <td data-label="Amount" style={{ ...td, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: isIncome ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                          {isIncome ? '+' : '−'}{formatINR(t.amount)}
                        </td>
                        <td data-label="" style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button type="button" onClick={() => setHistoryEntry(t)} style={{ ...linkButton, color: 'var(--text-secondary)' }}>History</button>
                          {canChange(t) && <button type="button" onClick={() => setForm({ transaction: t })} style={{ ...linkButton, color: 'var(--accent-primary)' }}>Edit</button>}
                          {canChange(t) && <button type="button" onClick={() => handleDelete(t)} style={{ ...linkButton, color: 'var(--accent-danger)' }}>Delete</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {pagination.total > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Rows
                <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="input-field" style={{ width: 'auto', padding: '6px 8px' }}>
                  {[20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              {pagination.pages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Button variant="default" onClick={() => setPage(p => p - 1)} disabled={page <= 1 || loading} style={{ width: 'auto', padding: '8px 14px' }}>← Prev</Button>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Page {pagination.page} of {pagination.pages}</span>
                  <Button variant="default" onClick={() => setPage(p => p + 1)} disabled={page >= pagination.pages || loading} style={{ width: 'auto', padding: '8px 14px' }}>Next →</Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Maths over the ticked entries */}
      {/* Portal to <body> so the fixed bar sticks to the screen, not the animated page container */}
      {selectedList.length > 0 && createPortal(
        <div className="selection-bar" role="region" aria-label="Selected entries" style={{
          position: 'fixed', left: '50%', bottom: '16px', transform: 'translateX(-50%)', zIndex: 90, width: 'min(960px, calc(100% - 32px))',
          background: '#1c1c1c', border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
          padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <strong style={{ color: 'var(--accent-primary)', whiteSpace: 'nowrap' }}>{selection.count} selected</strong>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button type="button" onClick={() => setSelected({})} style={{ ...linkButton, color: 'var(--text-secondary)' }}>Clear</button>
              {perms.canEditOwn && <button type="button" onClick={handleBulkDelete} style={{ ...linkButton, color: 'var(--accent-danger)' }}>Delete</button>}
            </div>
          </div>
          <div className="selection-stats" style={{ display: 'flex', gap: '6px 18px', flexWrap: 'wrap', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
            <span>Income <strong style={{ color: 'var(--accent-success)' }}>{formatINR(selection.income)}</strong></span>
            <span>Expense <strong style={{ color: 'var(--accent-danger)' }}>{formatINR(selection.expense)}</strong></span>
            <span>Net <strong style={{ color: amountColor(selection.net) }}>{formatINR(selection.net, { signed: true })}</strong></span>
            <span>Sum <strong style={{ color: 'var(--text-primary)' }}>{formatINR(selection.sum)}</strong></span>
            <span>Average <strong style={{ color: 'var(--text-primary)' }}>{formatINR(selection.avg)}</strong></span>
            <span>Min <strong style={{ color: 'var(--text-primary)' }}>{formatINR(selection.min)}</strong></span>
            <span>Max <strong style={{ color: 'var(--text-primary)' }}>{formatINR(selection.max)}</strong></span>
          </div>
        </div>,
        document.body
      )}

      {historyEntry && <EntryHistory entry={historyEntry} onClose={() => setHistoryEntry(null)} />}

      {form && (
        <TransactionForm
          transaction={form.transaction}
          categories={categories}
          paymentMethods={paymentMethods}
          yatras={yatras}
          onClose={() => setForm(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default Ledger;
