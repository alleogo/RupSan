import React, { useState, useEffect } from 'react';
import { centreApi } from '../utils/api';

// "Who can see this yatra?" — only the owning centre, all centres, or chosen centres.
// Without an owning centre (no one involved belongs to one) the choice is all centres or only chosen ones.
// value: { allCentres: boolean, centres: [centreId] }
const VisibilityPicker = ({ value, onChange, ownCentreId }) => {
  const [centres, setCentres] = useState([]);
  const [mode, setMode] = useState(value.allCentres ? 'all' : value.centres.length ? 'selected' : 'own');

  useEffect(() => {
    centreApi.list().then(res => setCentres(res.data.centres)).catch(() => {});
  }, []);

  const others = centres.filter(c => c._id !== ownCentreId);
  const ownName = centres.find(c => c._id === ownCentreId)?.name;

  const choose = (next) => {
    setMode(next);
    onChange({ allCentres: next === 'all', centres: next === 'selected' ? value.centres : [] });
  };
  const toggle = (id) => {
    const set = value.centres.includes(id) ? value.centres.filter(c => c !== id) : [...value.centres, id];
    onChange({ allCentres: false, centres: set });
  };

  const option = (key, label) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
      <input type="radio" name="yatra-visibility" checked={mode === key} onChange={() => choose(key)} style={{ accentColor: 'var(--accent-primary)' }} />
      {label}
    </label>
  );

  return (
    <fieldset style={{ border: 'none', padding: 0, margin: '0 0 12px' }}>
      <legend style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Who can see this yatra?</legend>
      {ownCentreId && option('own', `Only ${ownName || 'my centre'}`)}
      {option('all', 'All centres')}
      {option('selected', ownCentreId ? `${ownName || 'My centre'} and chosen centres` : 'Only chosen centres')}
      {mode === 'selected' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', margin: '4px 0 0 26px' }}>
          {others.length === 0 ? <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>There are no other centres yet.</span> : others.map(c => (
            <label key={c._id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={value.centres.includes(c._id)} onChange={() => toggle(c._id)} style={{ accentColor: 'var(--accent-primary)' }} />
              {c.name}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
};

export default VisibilityPicker;
