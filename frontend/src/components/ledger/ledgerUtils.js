// Shared helpers for the accounts (ledger) pages

export const formatINR = (value, { signed = false } = {}) => {
  const n = Number(value) || 0;
  const formatted = `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  if (n < 0) return `−${formatted}`;
  return signed && n > 0 ? `+${formatted}` : formatted;
};

// Short form for chart axes: ₹950, ₹12.5K, ₹3.2L, ₹1.1Cr
export const formatCompactINR = (value) => {
  const n = Math.abs(Number(value) || 0);
  const sign = value < 0 ? '−' : '';
  if (n >= 1e7) return `${sign}₹${+(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `${sign}₹${+(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `${sign}₹${+(n / 1e3).toFixed(1)}K`;
  return `${sign}₹${Math.round(n)}`;
};

export const PAYMENT_TYPES = ['Cash', 'Online', 'Cheque', 'Other'];
export const ONLINE_METHODS = ['UPI', 'Bank Transfer', 'Card', 'Wallet', 'Other'];

export const DEFAULT_CATEGORIES = {
  Income: ['Donation', 'Registration Fee', 'Sponsorship', 'Sale', 'Refund', 'Other Income'],
  Expense: ['Travel', 'Accommodation', 'Food & Prasadam', 'Tickets', 'Utilities', 'Salary', 'Printing', 'Maintenance', 'Miscellaneous']
};

// Label for the payment reference field, by payment type
export const PAYMENT_ID_LABEL = {
  Cash: 'Receipt number',
  Online: 'Transaction ID / UTR',
  Cheque: 'Cheque number',
  Other: 'Reference'
};

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Chart colours for income/expense marks, validated for colour-blind separation on the dark card surface.
// Text never uses these; amounts keep the app's text colours.
export const CHART_COLORS = { income: '#199e70', expense: '#d95926' };

const pad = (n) => String(n).padStart(2, '0');
export const toDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toMonth = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const today = () => toDay(new Date());

export const PERIOD_PRESETS = [
  { key: 'all', label: 'All time' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'thisYear', label: 'This year' },
  { key: 'month', label: 'Pick month' },
  { key: 'custom', label: 'Custom range' }
];

// Turn the selected period into the query params the API understands
export const periodParams = (period) => {
  const now = new Date();
  switch (period.preset) {
    case 'thisMonth':
      return { month: toMonth(now) };
    case 'lastMonth':
      return { month: toMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1)) };
    case 'thisYear':
      return { startDate: `${now.getFullYear()}-01-01`, endDate: `${now.getFullYear()}-12-31` };
    case 'month':
      return period.month ? { month: period.month } : {};
    case 'custom': {
      const params = {};
      if (period.startDate) params.startDate = period.startDate;
      if (period.endDate) params.endDate = period.endDate;
      return params;
    }
    default:
      return {};
  }
};

// Human-readable name of the selected period, e.g. "November 2026"
export const periodLabel = (period) => {
  const params = periodParams(period);
  if (params.month) {
    const [y, m] = params.month.split('-').map(Number);
    return `${new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long' })} ${y}`;
  }
  if (period.preset === 'thisYear') return `${new Date().getFullYear()}`;
  if (params.startDate || params.endDate) {
    const fmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${params.startDate ? fmt(params.startDate) : 'Start'} – ${params.endDate ? fmt(params.endDate) : 'Today'}`;
  }
  return 'All time';
};

export const modalOverlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center',
  alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '16px'
};

export const modalBoxStyle = {
  width: '100%', maxWidth: '560px', background: 'var(--bg-secondary)', padding: '24px', borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border-color)', maxHeight: '92vh', overflowY: 'auto'
};

export const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' };

export const pillStyle = (active) => ({
  padding: '8px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
  background: active ? 'rgba(212,175,55,0.15)' : 'transparent',
  color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
  border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-color)'}`
});
