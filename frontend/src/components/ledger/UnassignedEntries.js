import React, { useState, useEffect, useCallback } from 'react';
import Card from '../Card';
import { transactionApi } from '../../utils/api';
import { formatINR } from './ledgerUtils';

// Super Admin: ledger entries from before centre accounts, grouped by who recorded them,
// with a way to move each person's entries into a centre's account
const UnassignedEntries = ({ centres, onMoved }) => {
  const [groups, setGroups] = useState(null);
  const [choice, setChoice] = useState({});

  const load = useCallback(() => {
    transactionApi.unassigned().then(res => setGroups(res.data.groups)).catch(() => setGroups([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const move = async (g) => {
    const centreId = choice[g._id] || g.recorderCentre?._id;
    const centre = centres.find(c => c._id === centreId);
    if (!centre) return alert('Choose a centre first.');
    if (!window.confirm(`Move ${g.count} entr${g.count === 1 ? 'y' : 'ies'} recorded by ${g.recorder?.firstName || 'this person'} into the ${centre.name} account?`)) return;
    try {
      const res = await transactionApi.assignUnassigned(g._id, centreId);
      onMoved(res.data.message);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not move the entries.');
    }
  };

  if (!groups || groups.length === 0) return null;

  return (
    <Card style={{ marginBottom: '20px', borderLeft: '4px solid var(--accent-warning)' }}>
      <h3 style={{ marginBottom: '4px' }}>Entries from before centre accounts</h3>
      <p style={{ fontSize: '0.9rem', marginBottom: '12px' }}>These were kept in personal ledgers and aren't in any centre's account yet. Move each person's entries into the right centre.</p>
      {groups.map(g => (
        <div key={g._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '10px 0', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'var(--text-primary)' }}>{g.recorder?.firstName ? `${g.recorder.firstName} ${g.recorder.lastName}` : 'Unknown person'}</div>
            <div style={{ fontSize: '0.8rem' }}>
              {g.count} entr{g.count === 1 ? 'y' : 'ies'} · income {formatINR(g.income)} · expenses {formatINR(g.expense)}
              {g.recorderCentre?.name ? ` · now in ${g.recorderCentre.name}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select value={choice[g._id] || g.recorderCentre?._id || ''} onChange={(e) => setChoice({ ...choice, [g._id]: e.target.value })} className="input-field" style={{ width: 'auto', padding: '8px' }} aria-label="Centre to move into">
              <option value="" disabled>Choose centre</option>
              {centres.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <button type="button" onClick={() => move(g)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Move</button>
          </div>
        </div>
      ))}
    </Card>
  );
};

export default UnassignedEntries;
