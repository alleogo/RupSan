import React, { useState, useEffect, useCallback } from 'react';
import Card from '../Card';
import { transactionApi } from '../../utils/api';
import { formatINR } from './ledgerUtils';

// Deleted entries of the account, with Restore (centre admins and the Super Admin)
const DeletedEntries = ({ params, onRestored }) => {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');
  const key = JSON.stringify(params);

  const load = useCallback(() => {
    transactionApi.getDeleted(JSON.parse(key))
      .then(res => setEntries(res.data.transactions))
      .catch(err => setError(err.response?.data?.message || 'Could not load deleted entries.'));
  }, [key]);

  useEffect(() => { load(); }, [load]);

  const restore = async (t) => {
    try {
      const res = await transactionApi.restore(t._id);
      onRestored(res.data.message);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not restore the entry.');
    }
  };

  return (
    <Card>
      <h3 style={{ marginBottom: '4px' }}>Deleted entries</h3>
      <p style={{ fontSize: '0.9rem', marginBottom: '16px' }}>Deleted entries don't count in any totals. Restore one to bring it back.</p>
      {error ? <p role="alert" style={{ color: 'var(--accent-danger)' }}>{error}</p> : !entries ? <p>Loading…</p> : entries.length === 0 ? <p style={{ fontSize: '0.9rem' }}>Nothing has been deleted.</p> : (
        <div className="table-scroll" style={{ overflowX: 'auto' }}>
          <table className="stack-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['Entry', 'Date', 'Amount', 'Deleted', ''].map((h, i) => <th key={i} style={{ padding: '10px 12px', textAlign: i === 2 ? 'right' : 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {entries.map(t => (
                <tr key={t._id} style={{ borderBottom: '1px solid rgba(var(--tint-rgb),0.05)' }}>
                  <td data-label="" className="stack-title" style={{ padding: '10px 12px' }}>
                    <div style={{ color: 'var(--text-primary)' }}>{t.description}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t.category} · added by {t.recordedBy ? `${t.recordedBy.firstName} ${t.recordedBy.lastName}` : '—'}</div>
                  </td>
                  <td data-label="Date" style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</td>
                  <td data-label="Amount" style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap', color: t.type === 'Income' ? 'var(--accent-success)' : 'var(--accent-danger)' }}>{t.type === 'Income' ? '+' : '−'}{formatINR(t.amount)}</td>
                  <td data-label="Deleted" style={{ padding: '10px 12px', fontSize: '0.85rem' }}>{new Date(t.deletedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} by {t.deletedBy ? t.deletedBy.firstName : '—'}</td>
                  <td data-label="" style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <button type="button" onClick={() => restore(t)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Restore</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

export default DeletedEntries;
