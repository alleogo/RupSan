import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Button from '../Button';
import { transactionApi } from '../../utils/api';
import { formatINR, modalOverlayStyle, modalBoxStyle } from './ledgerUtils';

// Audit trail of one entry: who created, edited, deleted, restored or moved it, and what changed
const FIELD_LABELS = { type: 'Type', amount: 'Amount', date: 'Date', category: 'Category', description: 'Description', party: 'Party', paymentType: 'Payment type', paymentMethod: 'Payment method', paymentId: 'Payment ID', paymentProof: 'Payment proof', yatra: 'Linked yatra', notes: 'Notes', centre: 'Account' };
const ACTION_LABELS = { created: 'Added', edited: 'Edited', deleted: 'Deleted', restored: 'Restored', moved: 'Moved into this account' };

const show = (field, value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'amount') return formatINR(value);
  if (field === 'paymentProof') return 'a file';
  if (field === 'yatra' || field === 'centre') return 'linked';
  return String(value);
};

const EntryHistory = ({ entry, onClose }) => {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    transactionApi.history(entry._id)
      .then(res => setHistory(res.data.history))
      .catch(err => setError(err.response?.data?.message || 'Could not load the history.'));
  }, [entry._id]);

  return createPortal(
    <div style={modalOverlayStyle} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="animate-fade-in" style={modalBoxStyle} role="dialog" aria-modal="true" aria-label="Entry history">
        <h2 style={{ marginBottom: '4px' }}>History</h2>
        <p style={{ marginBottom: '16px', fontSize: '0.9rem' }}>{entry.description} · {formatINR(entry.amount)}</p>
        {error ? <p role="alert" style={{ color: 'var(--accent-danger)' }}>{error}</p> : !history ? <p>Loading…</p> : history.length === 0 ? (
          <p style={{ fontSize: '0.9rem' }}>No history recorded for this entry (it was added before the audit trail existed).</p>
        ) : (
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {[...history].reverse().map((h, i) => (
              <li key={i} style={{ padding: '10px 0', borderTop: i ? '1px solid var(--border-color)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{ACTION_LABELS[h.action] || h.action}</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {h.by ? `${h.by.firstName} ${h.by.lastName}` : 'Someone'} · {new Date(h.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                {h.action === 'edited' && h.changes?.length > 0 && (
                  <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {h.changes.map((c, j) => (
                      <li key={j}>{FIELD_LABELS[c.field] || c.field}: <span style={{ textDecoration: 'line-through' }}>{show(c.field, c.from)}</span> → <span style={{ color: 'var(--text-primary)' }}>{show(c.field, c.to)}</span></li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
        <Button variant="default" onClick={onClose} style={{ marginTop: '16px' }}>Close</Button>
      </div>
    </div>,
    document.body
  );
};

export default EntryHistory;
