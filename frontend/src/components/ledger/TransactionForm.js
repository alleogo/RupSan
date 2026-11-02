import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Button from '../Button';
import { transactionApi, getMediaUrl } from '../../utils/api';
import {
  PAYMENT_TYPES, ONLINE_METHODS, DEFAULT_CATEGORIES, PAYMENT_ID_LABEL, today,
  modalOverlayStyle, modalBoxStyle, labelStyle, pillStyle
} from './ledgerUtils';

// Vercel rejects request bodies over ~4.5MB, so keep uploads comfortably below that
const PROOF_MAX_MB = 4;

const emptyForm = (type = 'Expense') => ({
  type,
  amount: '',
  date: today(),
  category: '',
  description: '',
  party: '',
  paymentType: 'Cash',
  paymentMethod: '',
  paymentId: '',
  yatra: '',
  notes: ''
});

const fromTransaction = (t) => ({
  type: t.type,
  amount: String(t.amount),
  date: new Date(t.date).toISOString().slice(0, 10),
  category: t.category || '',
  description: t.description || '',
  party: t.party || '',
  paymentType: t.paymentType || 'Cash',
  paymentMethod: t.paymentMethod || '',
  paymentId: t.paymentId || '',
  yatra: t.yatra?._id || t.yatra || '',
  notes: t.notes || ''
});

const Field = ({ label, children, style }) => (
  <div style={{ marginBottom: '14px', ...style }}>
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
);

const TransactionForm = ({ transaction, categories = [], paymentMethods = [], yatras = [], onClose, onSaved }) => {
  const isEdit = Boolean(transaction);
  const [form, setForm] = useState(isEdit ? fromTransaction(transaction) : emptyForm());
  const [proofFile, setProofFile] = useState(null);
  const [removeProof, setRemoveProof] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const categoryOptions = [...new Set([...DEFAULT_CATEGORIES[form.type], ...categories])];
  const methodOptions = [...new Set([...ONLINE_METHODS, ...paymentMethods])];

  const handleProofChange = (e) => {
    const file = e.target.files[0];
    setError('');
    if (!file) return setProofFile(null);
    if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) {
      e.target.value = '';
      return setError('Payment proof must be an image or a PDF.');
    }
    if (file.size > PROOF_MAX_MB * 1024 * 1024) {
      e.target.value = '';
      return setError(`Payment proof must be smaller than ${PROOF_MAX_MB}MB.`);
    }
    setProofFile(file);
    setRemoveProof(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!(parseFloat(form.amount) > 0)) return setError('Enter an amount greater than 0.');

    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      // Payment method only applies to online payments
      if (key === 'paymentMethod' && form.paymentType !== 'Online') value = '';
      data.append(key, value);
    });
    if (!form.category) data.set('category', form.type);
    if (proofFile) data.append('paymentProof', proofFile);
    if (removeProof) data.append('removeProof', 'true');

    setSaving(true);
    try {
      const res = isEdit ? await transactionApi.update(transaction._id, data) : await transactionApi.add(data);
      if (res.data.success) onSaved(res.data.transaction);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const existingProof = isEdit && transaction.paymentProof && !removeProof && !proofFile;

  // Portal to <body>: the page's fade-in animation leaves a transform that would otherwise anchor this fixed overlay to the page
  return createPortal(
    <div style={modalOverlayStyle} onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="animate-fade-in" style={modalBoxStyle} role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit entry' : 'Add entry'}>
        <h2 style={{ marginBottom: '20px' }}>{isEdit ? 'Edit Entry' : 'Add Entry'}</h2>

        <form onSubmit={handleSubmit}>
          {/* Income / Expense toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '18px' }}>
            {['Income', 'Expense'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setForm(f => ({ ...f, type, category: DEFAULT_CATEGORIES[f.type].includes(f.category) ? '' : f.category }))}
                style={{
                  padding: '10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem',
                  border: `1px solid ${form.type === type ? (type === 'Income' ? 'var(--accent-success)' : 'var(--accent-danger)') : 'var(--border-color)'}`,
                  background: form.type === type ? (type === 'Income' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)') : 'transparent',
                  color: form.type === type ? (type === 'Income' ? 'var(--accent-success)' : 'var(--accent-danger)') : 'var(--text-secondary)'
                }}
              >
                {type === 'Income' ? '↓ Income' : '↑ Expense'}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '0 12px' }}>
            <Field label="Amount (₹) *">
              <input type="number" step="0.01" min="0.01" inputMode="decimal" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="input-field" placeholder="0.00" required autoFocus={!isEdit} />
            </Field>
            <Field label="Date *">
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className="input-field" required />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '0 12px' }}>
            <Field label="Category">
              <input list="ledger-categories" value={form.category} onChange={(e) => set('category', e.target.value)} className="input-field" placeholder={`e.g. ${DEFAULT_CATEGORIES[form.type][0]}`} />
              <datalist id="ledger-categories">
                {categoryOptions.map(c => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label={form.type === 'Income' ? 'Received from' : 'Paid to'}>
              <input value={form.party} onChange={(e) => set('party', e.target.value)} className="input-field" placeholder="Name of person or business" />
            </Field>
          </div>

          <Field label="Description *">
            <input value={form.description} onChange={(e) => set('description', e.target.value)} className="input-field" placeholder="What was this for?" required />
          </Field>

          <Field label="Payment type">
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PAYMENT_TYPES.map(pt => (
                <button key={pt} type="button" onClick={() => set('paymentType', pt)} style={pillStyle(form.paymentType === pt)}>{pt}</button>
              ))}
            </div>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '0 12px' }}>
            {form.paymentType === 'Online' && (
              <Field label="Payment method">
                <select value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)} className="input-field">
                  <option value="">Select method</option>
                  {methodOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            )}
            <Field label={PAYMENT_ID_LABEL[form.paymentType]}>
              <input value={form.paymentId} onChange={(e) => set('paymentId', e.target.value)} className="input-field" placeholder="Optional" />
            </Field>
          </div>

          <Field label={`Payment proof (image or PDF, max ${PROOF_MAX_MB}MB)`}>
            {existingProof ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <a href={getMediaUrl(transaction.paymentProof)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>📎 View current proof</a>
                <button type="button" onClick={() => setRemoveProof(true)} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', fontSize: '0.85rem' }}>Remove</button>
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}>
                  Replace
                  <input type="file" accept="image/*,application/pdf" onChange={handleProofChange} style={{ display: 'none' }} />
                </label>
              </div>
            ) : (
              <>
                <input type="file" accept="image/*,application/pdf" onChange={handleProofChange} className="input-field" style={{ padding: '8px' }} />
                {removeProof && (
                  <p style={{ fontSize: '0.8rem', marginTop: '6px' }}>
                    Current proof will be removed. <button type="button" onClick={() => setRemoveProof(false)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>Undo</button>
                  </p>
                )}
              </>
            )}
          </Field>

          {yatras.length > 0 && (
            <Field label="Linked yatra">
              <select value={form.yatra} onChange={(e) => set('yatra', e.target.value)} className="input-field">
                <option value="">None</option>
                {yatras.map(y => <option key={y._id} value={y._id}>{y.title}</option>)}
              </select>
            </Field>
          )}

          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className="input-field" rows="2" placeholder="Anything else worth remembering" />
          </Field>

          {error && (
            <p role="alert" style={{ color: 'var(--accent-danger)', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: 'var(--radius-sm)', marginBottom: '14px', fontSize: '0.9rem' }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button type="button" variant="default" onClick={onClose} disabled={saving} style={{ flex: 1 }}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving} style={{ flex: 1 }}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Entry'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default TransactionForm;
