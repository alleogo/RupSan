import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Card from '../Card';
import { transactionApi } from '../../utils/api';
import { formatINR, formatCompactINR, MONTH_NAMES, CHART_COLORS } from './ledgerUtils';

const CHART_HEIGHT = 240;
const MARGIN = { top: 12, right: 8, bottom: 28, left: 56 };

// Track an element's width so the chart can draw in real pixels (text stays readable on phones)
const useWidth = () => {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    setWidth(ref.current.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
};

// Round the axis maximum up to a clean value (1, 2, 2.5 or 5 × 10^n)
const niceMax = (value) => {
  if (value <= 0) return 1000;
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  const step = [1, 2, 2.5, 5, 10].find(s => s * power >= value);
  return step * power;
};

// Column with a 4px rounded top and a square base
const columnPath = (x, y, w, h) => {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
};

const MonthlyChart = ({ months }) => {
  const [ref, width] = useWidth();
  const [active, setActive] = useState(null);

  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
  const max = niceMax(Math.max(...months.map(m => Math.max(m.income, m.expense))));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * max);
  const band = plotW / 12;
  const gap = 2;
  const barW = Math.max(2, Math.min(24, (band * 0.7 - gap) / 2));
  const y = (v) => MARGIN.top + plotH - (v / max) * plotH;

  const activeMonth = active !== null ? months[active] : null;
  const tooltipLeft = active !== null ? MARGIN.left + band * active + band / 2 : 0;
  const flip = tooltipLeft > width - 170;

  return (
    <div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        {[['Income', CHART_COLORS.income], ['Expense', CHART_COLORS.expense]].map(([label, color]) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: color }} />
            {label}
          </span>
        ))}
      </div>

      <div ref={ref} style={{ position: 'relative', width: '100%', height: CHART_HEIGHT }}>
        {width > 0 && (
          <svg width={width} height={CHART_HEIGHT} role="img" aria-label="Monthly income and expense chart. The table below lists every value.">
            {/* Gridlines and y-axis ticks */}
            {ticks.map(t => (
              <g key={t}>
                <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth="1" />
                <text x={MARGIN.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--text-secondary)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatCompactINR(t)}
                </text>
              </g>
            ))}

            {months.map((m, i) => {
              const cx = MARGIN.left + band * i + band / 2;
              const incomeH = (m.income / max) * plotH;
              const expenseH = (m.expense / max) * plotH;
              return (
                <g
                  key={m.month}
                  tabIndex={0}
                  role="button"
                  aria-label={`${MONTH_NAMES[i]}: income ${formatINR(m.income)}, expense ${formatINR(m.expense)}, net ${formatINR(m.net)}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  style={{ outline: 'none', cursor: 'default' }}
                >
                  {/* Whole month band is the hover target */}
                  <rect x={MARGIN.left + band * i} y={MARGIN.top} width={band} height={plotH} fill={active === i ? 'rgba(var(--tint-rgb),0.04)' : 'transparent'} />
                  {incomeH > 0 && <path d={columnPath(cx - gap / 2 - barW, y(m.income), barW, incomeH)} fill={CHART_COLORS.income} opacity={active === null || active === i ? 1 : 0.55} />}
                  {expenseH > 0 && <path d={columnPath(cx + gap / 2, y(m.expense), barW, expenseH)} fill={CHART_COLORS.expense} opacity={active === null || active === i ? 1 : 0.55} />}
                  <text x={cx} y={CHART_HEIGHT - 8} textAnchor="middle" fontSize="11" fill={active === i ? 'var(--text-primary)' : 'var(--text-secondary)'}>
                    {width < 480 ? MONTH_NAMES[i][0] : MONTH_NAMES[i]}
                  </text>
                </g>
              );
            })}

            {/* Baseline */}
            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(0)} y2={y(0)} stroke="var(--chart-axis)" strokeWidth="1" />
          </svg>
        )}

        {activeMonth && (
          <div style={{
            position: 'absolute', top: MARGIN.top, left: tooltipLeft, transform: flip ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
            background: 'var(--surface-raised)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 12px',
            pointerEvents: 'none', minWidth: '150px', boxShadow: 'var(--glass-shadow)', fontSize: '0.85rem'
          }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '6px', lineHeight: 1.2 }}>{MONTH_NAMES[active]}</p>
            {[['Income', activeMonth.income, CHART_COLORS.income], ['Expense', activeMonth.expense, CHART_COLORS.expense]].map(([label, value, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ width: '10px', height: '2px', background: color }} />
                <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatINR(value)}</strong>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '6px', paddingTop: '6px', display: 'flex', gap: '8px' }}>
              <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatINR(activeMonth.net, { signed: true })}</strong>
              <span style={{ color: 'var(--text-secondary)' }}>Net</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const amountColor = (n) => (n > 0 ? 'var(--accent-success)' : n < 0 ? 'var(--accent-danger)' : 'var(--text-secondary)');
const th = { padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' };
const td = { padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

const MonthlyView = ({ filterParams, onSelectMonth }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const paramsKey = JSON.stringify(filterParams);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    transactionApi.getMonthly({ ...JSON.parse(paramsKey), year })
      .then(res => { if (!cancelled && res.data.success) setData(res.data); })
      .catch(err => console.error('Failed to load monthly summary:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year, paramsKey]);

  const years = data?.availableYears || [year];

  return (
    <div style={{ opacity: loading && data ? 0.5 : 1, transition: 'opacity 0.15s' }}>
      <Card style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button type="button" onClick={() => setYear(y => y - 1)} aria-label="Previous year" className="btn btn-default" style={{ padding: '6px 12px' }}>‹</button>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input-field" style={{ width: 'auto', padding: '6px 10px' }} aria-label="Year">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button type="button" onClick={() => setYear(y => y + 1)} aria-label="Next year" className="btn btn-default" style={{ padding: '6px 12px' }}>›</button>
          </div>
          {data && (
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '0.9rem' }}>
              <span>Opening <strong style={{ color: 'var(--text-primary)' }}>{formatINR(data.openingBalance)}</strong></span>
              <span>Closing <strong style={{ color: 'var(--text-primary)' }}>{formatINR(data.closingBalance)}</strong></span>
            </div>
          )}
        </div>

        {!data ? (
          <p>Loading monthly summary…</p>
        ) : data.totals.count === 0 ? (
          <p style={{ textAlign: 'center', padding: '32px 0' }}>No entries in {year}.</p>
        ) : (
          <MonthlyChart months={data.months} />
        )}
      </Card>

      {data && data.totals.count > 0 && (
        <Card>
          <h3 style={{ marginBottom: '12px' }}>Month by month</h3>
          <div className="table-scroll" style={{ overflowX: 'auto' }}>
            <table className="stack-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ ...th, textAlign: 'left' }}>Month</th>
                  <th style={th}>Income</th>
                  <th style={th}>Expense</th>
                  <th style={th}>Net</th>
                  <th style={th}>Entries</th>
                  <th style={th}>Balance</th>
                  <th style={th}><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m, i) => (
                  <tr key={m.month} style={{ borderBottom: '1px solid rgba(var(--tint-rgb),0.05)', opacity: m.count ? 1 : 0.5 }}>
                    <td data-label="" className="stack-title" style={{ ...td, textAlign: 'left', fontWeight: 500 }}>{MONTH_NAMES[i]} {year}</td>
                    <td data-label="Income" style={{ ...td, color: m.income ? 'var(--accent-success)' : 'var(--text-secondary)' }}>{formatINR(m.income)}</td>
                    <td data-label="Expense" style={{ ...td, color: m.expense ? 'var(--accent-danger)' : 'var(--text-secondary)' }}>{formatINR(m.expense)}</td>
                    <td data-label="Net" style={{ ...td, color: amountColor(m.net), fontWeight: 600 }}>{formatINR(m.net, { signed: true })}</td>
                    <td data-label="Entries" style={td}>{m.count}</td>
                    <td data-label="Balance" style={td}>{formatINR(m.closingBalance)}</td>
                    <td data-label="" style={td}>
                      {m.count > 0 && (
                        <button type="button" onClick={() => onSelectMonth(`${year}-${String(m.month).padStart(2, '0')}`)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.85rem' }}>
                          View entries →
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid var(--border-color)', fontWeight: 700 }}>
                  <td data-label="" className="stack-title" style={{ ...td, textAlign: 'left' }}>Total {year}</td>
                  <td data-label="Income" style={{ ...td, color: 'var(--accent-success)' }}>{formatINR(data.totals.income)}</td>
                  <td data-label="Expense" style={{ ...td, color: 'var(--accent-danger)' }}>{formatINR(data.totals.expense)}</td>
                  <td data-label="Net" style={{ ...td, color: amountColor(data.totals.net) }}>{formatINR(data.totals.net, { signed: true })}</td>
                  <td data-label="Entries" style={td}>{data.totals.count}</td>
                  <td data-label="Balance" style={td}>{formatINR(data.closingBalance)}</td>
                  <td style={td} />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default MonthlyView;
