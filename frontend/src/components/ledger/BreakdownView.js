import React, { useState, useEffect } from 'react';
import Card from '../Card';
import { transactionApi } from '../../utils/api';
import { formatINR, CHART_COLORS } from './ledgerUtils';

// One row per category: name, amount and share, with a thin bar showing the share
const ShareList = ({ title, rows, color, emptyText, onSelect }) => {
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  return (
    <Card style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <h3>{title}</h3>
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatINR(total)}</strong>
      </div>
      {rows.length === 0 ? (
        <p style={{ fontSize: '0.9rem' }}>{emptyText}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {rows.map(r => {
            const share = total ? (r.total / total) * 100 : 0;
            return (
              <button
                key={r.category}
                type="button"
                onClick={() => onSelect(r.category)}
                title={`Show ${r.category} entries`}
                className="breakdown-row"
                style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit', width: '100%' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '6px', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.category} <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>· {r.count}</span>
                  </span>
                  <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: 'var(--text-primary)' }}>{formatINR(r.total)}</span>
                    <span style={{ color: 'var(--text-secondary)', marginLeft: '8px', display: 'inline-block', minWidth: '3.2em', textAlign: 'right' }}>{share.toFixed(share < 10 ? 1 : 0)}%</span>
                  </span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(var(--tint-rgb),0.06)' }}>
                  <div style={{ width: `${Math.max(share, 1)}%`, height: '100%', borderRadius: '3px', background: color }} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
};

const BreakdownView = ({ filterParams, periodName, onSelectCategory }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const paramsKey = JSON.stringify(filterParams);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    transactionApi.getBreakdown(JSON.parse(paramsKey))
      .then(res => { if (!cancelled && res.data.success) setData(res.data); })
      .catch(err => console.error('Failed to load breakdown:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [paramsKey]);

  if (!data) return <Card><p>Loading breakdown…</p></Card>;

  return (
    <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
      <p style={{ fontSize: '0.9rem', marginBottom: '16px' }}>Showing {periodName.toLowerCase() === 'all time' ? 'all entries' : periodName} matching your filters. Click a category to see its entries.</p>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex' }}>
          <ShareList title="Expenses by category" rows={data.expense} color={CHART_COLORS.expense} emptyText="No expenses in this period." onSelect={(c) => onSelectCategory(c, 'Expense')} />
        </div>
        <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex' }}>
          <ShareList title="Income by category" rows={data.income} color={CHART_COLORS.income} emptyText="No income in this period." onSelect={(c) => onSelectCategory(c, 'Income')} />
        </div>
      </div>

      <Card>
        <h3 style={{ marginBottom: '12px' }}>By payment type</h3>
        {data.paymentTypes.length === 0 ? (
          <p style={{ fontSize: '0.9rem' }}>No entries in this period.</p>
        ) : (
          <div className="table-scroll" style={{ overflowX: 'auto' }}>
            <table className="stack-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['Payment type', 'Income', 'Expense', 'Net', 'Entries'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.paymentTypes.map(p => {
                  const net = p.income - p.expense;
                  const cell = { padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
                  return (
                    <tr key={p.paymentType} style={{ borderBottom: '1px solid rgba(var(--tint-rgb),0.05)' }}>
                      <td data-label="" className="stack-title" style={{ ...cell, textAlign: 'left', fontWeight: 500 }}>{p.paymentType}</td>
                      <td data-label="Income" style={{ ...cell, color: 'var(--accent-success)' }}>{formatINR(p.income)}</td>
                      <td data-label="Expense" style={{ ...cell, color: 'var(--accent-danger)' }}>{formatINR(p.expense)}</td>
                      <td data-label="Net" style={{ ...cell, fontWeight: 600 }}>{formatINR(net, { signed: true })}</td>
                      <td data-label="Entries" style={cell}>{p.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default BreakdownView;
