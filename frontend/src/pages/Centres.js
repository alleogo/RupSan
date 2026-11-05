import React, { useState, useEffect, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import { centreApi, userApi } from '../utils/api';
import { AuthContext } from '../context/AuthContext';

// Super Admin: the centre list, each centre's admin and co-admins, and admins without a centre

const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' };
const linkButton = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: '4px 6px' };
const personName = (u) => (u ? `${u.firstName} ${u.lastName}` : '');

const Modal = ({ title, onClose, busy, children }) => createPortal(
  <div onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px', backdropFilter: 'blur(4px)' }}>
    <div role="dialog" aria-modal="true" aria-label={title} className="animate-fade-in" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
      <h2 style={{ marginBottom: '16px' }}>{title}</h2>
      {children}
    </div>
  </div>,
  document.body
);

// Pick a participant or manager to become a centre's admin
const AppointAdminDialog = ({ centre, onClose, onDone }) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [chosen, setChosen] = useState(null);
  const [previousRole, setPreviousRole] = useState('Manager');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = { limit: 8 };
      if (search.trim()) params.search = search.trim();
      userApi.getAll(params)
        .then(res => setResults(res.data.users.filter(u => u.role === 'Participant' || u.role === 'Manager' || (u.role === 'Admin' && !u.centreId))))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await centreApi.appointAdmin(centre._id, chosen._id, previousRole);
      onDone(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not appoint the admin.');
      setBusy(false);
    }
  };

  return (
    <Modal title={`${centre.admin ? 'Change' : 'Appoint'} admin of ${centre.name}`} onClose={onClose} busy={busy}>
      <label style={labelStyle} htmlFor="appoint-search">Find a participant or manager</label>
      <input id="appoint-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field" placeholder="Name, email or phone" autoFocus />
      <div style={{ margin: '10px 0 16px', maxHeight: '240px', overflowY: 'auto' }}>
        {results.length === 0 ? <p style={{ fontSize: '0.85rem', padding: '8px 0' }}>No matching participants or managers.</p> : results.map(u => (
          <label key={u._id} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: chosen?._id === u._id ? 'rgba(212,175,55,0.1)' : 'transparent' }}>
            <input type="radio" name="appoint-user" checked={chosen?._id === u._id} onChange={() => setChosen(u)} style={{ accentColor: 'var(--accent-primary)' }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ color: 'var(--text-primary)' }}>{personName(u)}</span>
              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>
                {u.email} · {u.role}{u.centreId?.name ? ` · ${u.centreId.name}` : ' · no centre'}
              </span>
            </span>
          </label>
        ))}
      </div>
      {chosen && chosen.centreId && chosen.centreId._id !== centre._id && (
        <p style={{ fontSize: '0.85rem', color: 'var(--accent-warning)', marginBottom: '12px' }}>{chosen.firstName} will move from {chosen.centreId.name} to {centre.name}.</p>
      )}
      {centre.admin && (
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle} htmlFor="previous-role">{personName(centre.admin)} (current admin) becomes</label>
          <select id="previous-role" value={previousRole} onChange={(e) => setPreviousRole(e.target.value)} className="input-field">
            <option value="Manager">Manager</option>
            <option value="Participant">Participant</option>
          </select>
        </div>
      )}
      {error && <p role="alert" style={{ color: 'var(--accent-danger)', fontSize: '0.9rem', marginBottom: '12px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button variant="default" onClick={onClose} disabled={busy} style={{ flex: 1 }}>Cancel</Button>
        <Button onClick={submit} disabled={busy || !chosen} style={{ flex: 1 }}>{busy ? 'Saving…' : 'Make admin'}</Button>
      </div>
    </Modal>
  );
};

// Change the role of a centre admin (or of an admin without a centre)
const ChangeRoleDialog = ({ title, text, onSubmit, onClose }) => {
  const [role, setRole] = useState('Manager');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await onSubmit(role);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change the role.');
      setBusy(false);
    }
  };
  return (
    <Modal title={title} onClose={onClose} busy={busy}>
      <p style={{ fontSize: '0.9rem', marginBottom: '16px' }}>{text}</p>
      <label style={labelStyle} htmlFor="new-role">New role</label>
      <select id="new-role" value={role} onChange={(e) => setRole(e.target.value)} className="input-field" style={{ marginBottom: '16px' }}>
        <option value="Manager">Manager</option>
        <option value="Participant">Participant</option>
      </select>
      {error && <p role="alert" style={{ color: 'var(--accent-danger)', fontSize: '0.9rem', marginBottom: '12px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button variant="default" onClick={onClose} disabled={busy} style={{ flex: 1 }}>Cancel</Button>
        <Button variant="danger" onClick={submit} disabled={busy} style={{ flex: 1 }}>{busy ? 'Saving…' : 'Change role'}</Button>
      </div>
    </Modal>
  );
};

const EMPTY_CENTRE = { name: '', description: '', place: '', location: '', pm: { name: '', phone: '', email: '' } };
const mapLink = (location, place) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([location, place].filter(Boolean).join(', '))}`;

// Add or edit a centre's details
const CentreFormDialog = ({ centre, onClose, onDone }) => {
  const [form, setForm] = useState(centre ? {
    name: centre.name, description: centre.description || '', place: centre.place || '', location: centre.location || '',
    pm: { name: centre.pm?.name || '', phone: centre.pm?.phone || '', email: centre.pm?.email || '' }
  } : EMPTY_CENTRE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const setPm = (key, value) => setForm(f => ({ ...f, pm: { ...f.pm, [key]: value } }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = centre ? await centreApi.update(centre._id, form) : await centreApi.create(form);
      onDone(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the centre.');
      setBusy(false);
    }
  };

  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '0 12px' };
  const field = (id, label, input) => (
    <div style={{ marginBottom: '12px' }}>
      <label style={labelStyle} htmlFor={id}>{label}</label>
      {input}
    </div>
  );

  return (
    <Modal title={centre ? `Edit ${centre.name}` : 'Add a centre'} onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <div style={grid}>
          {field('centre-name', 'Centre name *', <input id="centre-name" value={form.name} onChange={(e) => set('name', e.target.value)} className="input-field" maxLength={100} required autoFocus />)}
          {field('centre-place', 'City / town / village', <input id="centre-place" value={form.place} onChange={(e) => set('place', e.target.value)} className="input-field" maxLength={100} />)}
        </div>
        {field('centre-location', 'Location (address or directions)', <input id="centre-location" value={form.location} onChange={(e) => set('location', e.target.value)} className="input-field" maxLength={300} placeholder="e.g. Near ISKCON temple, Raman Reti" />)}
        {field('centre-description', 'Description', <textarea id="centre-description" value={form.description} onChange={(e) => set('description', e.target.value)} className="input-field" rows="3" maxLength={1000} />)}
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 8px' }}>Project manager (PM)</p>
        <div style={grid}>
          {field('pm-name', 'Name', <input id="pm-name" value={form.pm.name} onChange={(e) => setPm('name', e.target.value)} className="input-field" maxLength={100} />)}
          {field('pm-phone', 'Phone', <input id="pm-phone" type="tel" value={form.pm.phone} onChange={(e) => setPm('phone', e.target.value)} className="input-field" maxLength={20} />)}
          {field('pm-email', 'Email', <input id="pm-email" type="email" value={form.pm.email} onChange={(e) => setPm('email', e.target.value)} className="input-field" maxLength={100} />)}
        </div>
        {error && <p role="alert" style={{ color: 'var(--accent-danger)', fontSize: '0.9rem', marginBottom: '12px' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <Button variant="default" onClick={onClose} disabled={busy} style={{ flex: 1 }}>Cancel</Button>
          <Button type="submit" disabled={busy} style={{ flex: 1 }}>{busy ? 'Saving…' : centre ? 'Save changes' : 'Add centre'}</Button>
        </div>
      </form>
    </Modal>
  );
};

const CentreCard = ({ centre, onChanged, onEdit, onAppoint, onChangeAdminRole }) => {
  const total = centre.members.Admin + centre.members.Manager + centre.members.Participant;
  const isEmpty = total === 0 && centre.yatras === 0 && centre.entries === 0;

  const remove = async () => {
    if (!window.confirm(`Delete the centre "${centre.name}"? This cannot be undone.`)) return;
    try {
      const res = await centreApi.remove(centre._id);
      onChanged(res.data.message);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not delete the centre.');
    }
  };

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ overflowWrap: 'anywhere' }}>{centre.name}</h3>
          {centre.place && <p style={{ fontSize: '0.85rem' }}>{centre.place}</p>}
        </div>
        <div style={{ display: 'flex', flexShrink: 0 }}>
          <button type="button" onClick={() => onEdit(centre)} style={{ ...linkButton, color: 'var(--accent-primary)' }}>Edit</button>
          <button type="button" onClick={remove} disabled={!isEmpty} title={isEmpty ? 'Delete this centre' : 'Only empty centres can be deleted'} style={{ ...linkButton, color: isEmpty ? 'var(--accent-danger)' : 'var(--text-secondary)', cursor: isEmpty ? 'pointer' : 'not-allowed' }}>Delete</button>
        </div>
      </div>

      {centre.description && <p style={{ fontSize: '0.9rem', margin: '8px 0', overflowWrap: 'anywhere' }}>{centre.description}</p>}
      {centre.location && (
        <p style={{ fontSize: '0.85rem', marginBottom: '8px', overflowWrap: 'anywhere' }}>
          📍 {centre.location} · <a href={mapLink(centre.location, centre.place)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>View on map</a>
        </p>
      )}
      {centre.pm?.name && (
        <p style={{ fontSize: '0.85rem', marginBottom: '8px', overflowWrap: 'anywhere' }}>
          PM: <span style={{ color: 'var(--text-primary)' }}>{centre.pm.name}</span>{centre.pm.phone ? ` · ${centre.pm.phone}` : ''}{centre.pm.email ? ` · ${centre.pm.email}` : ''}
        </p>
      )}

      <p style={{ fontSize: '0.85rem', margin: '8px 0 14px' }}>
        {total} member{total === 1 ? '' : 's'}: {centre.members.Admin} admin{centre.members.Admin === 1 ? '' : 's'} · {centre.members.Manager} manager{centre.members.Manager === 1 ? '' : 's'} · {centre.members.Participant} participant{centre.members.Participant === 1 ? '' : 's'}
        {centre.yatras ? ` · ${centre.yatras} yatra${centre.yatras === 1 ? '' : 's'}` : ''}
      </p>

      <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', marginBottom: '10px' }}>
        <p style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Admin</p>
        {centre.admin ? (
          <>
            <p style={{ color: 'var(--text-primary)' }}>{personName(centre.admin)}</p>
            <p style={{ fontSize: '0.8rem', overflowWrap: 'anywhere' }}>{centre.admin.email}</p>
          </>
        ) : (
          <p style={{ color: 'var(--accent-warning)' }}>No admin yet</p>
        )}
        <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => onAppoint(centre)} style={{ ...linkButton, paddingLeft: 0, color: 'var(--accent-primary)' }}>{centre.admin ? 'Change admin' : 'Appoint admin'}</button>
          {centre.admin && <button type="button" onClick={() => onChangeAdminRole(centre)} style={{ ...linkButton, color: 'var(--accent-danger)' }}>Change admin's role</button>}
        </div>
      </div>

      {centre.coAdmins.length > 0 && (
        <p style={{ fontSize: '0.85rem' }}>
          Co-admins: <span style={{ color: 'var(--text-primary)' }}>{centre.coAdmins.map(personName).join(', ')}</span>
        </p>
      )}
    </Card>
  );
};

const Centres = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(null);

  const load = useCallback(() => {
    setLoadError('');
    return centreApi.manage()
      .then(res => setData(res.data))
      .catch(err => setLoadError(err.response?.data?.message || 'Could not load centres.'));
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'SuperAdmin') { navigate('/'); return; }
    load();
  }, [user, navigate, load]);

  const done = (message) => {
    setDialog(null);
    setNotice(message);
    load();
  };

  return (
    <div className="animate-fade-in" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Centres</h1>
      <p style={{ marginBottom: '24px' }}>Renaming a centre renames it for all of its members.</p>

      {notice && <p role="status" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--accent-success)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.9rem' }}>✓ {notice}</p>}

      <div style={{ marginBottom: '24px' }}>
        <Button onClick={() => setDialog({ type: 'form', centre: null })} style={{ width: 'auto', padding: '10px 20px' }}>+ Add centre</Button>
      </div>

      {loadError ? (
        <Card><p role="alert" style={{ color: 'var(--accent-danger)', marginBottom: '12px' }}>{loadError}</p><Button variant="default" onClick={load} style={{ width: 'auto' }}>Try again</Button></Card>
      ) : !data ? (
        <p>Loading centres…</p>
      ) : (
        <>
          {data.unassignedAdmins.length > 0 && (
            <Card style={{ marginBottom: '24px', borderLeft: '4px solid var(--accent-warning)' }}>
              <h3 style={{ marginBottom: '6px' }}>Admins without a centre</h3>
              <p style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Each admin now belongs to one centre. Make these people the admin of a centre, or change their role.</p>
              {data.unassignedAdmins.map(a => (
                <div key={a._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '10px 0', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: 'var(--text-primary)' }}>{personName(a)}</div>
                    <div style={{ fontSize: '0.8rem', overflowWrap: 'anywhere' }}>{a.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select defaultValue="" onChange={async (e) => {
                      const centre = data.centres.find(c => c._id === e.target.value);
                      e.target.value = '';
                      if (!centre) return;
                      if (centre.admin && !window.confirm(`${centre.name} already has an admin (${personName(centre.admin)}), who will become a manager. Continue?`)) return;
                      try { done((await centreApi.appointAdmin(centre._id, a._id, 'Manager')).data.message); } catch (err) { alert(err.response?.data?.message || 'Could not assign the centre.'); }
                    }} className="input-field" style={{ width: 'auto', padding: '8px' }} aria-label={`Make ${personName(a)} admin of`}>
                      <option value="" disabled>Make admin of…</option>
                      {data.centres.map(c => <option key={c._id} value={c._id}>{c.name}{c.admin ? ' (has admin)' : ''}</option>)}
                    </select>
                    <button type="button" onClick={() => setDialog({ type: 'unassignedRole', admin: a })} style={{ ...linkButton, color: 'var(--accent-danger)' }}>Change role</button>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {data.centres.length === 0 ? (
            <Card><p>No centres yet. Add the first one with "+ Add centre".</p></Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: '20px' }}>
              {data.centres.map(c => (
                <CentreCard key={c._id} centre={c} onChanged={done} onEdit={(centre) => setDialog({ type: 'form', centre })} onAppoint={(centre) => setDialog({ type: 'appoint', centre })} onChangeAdminRole={(centre) => setDialog({ type: 'adminRole', centre })} />
              ))}
            </div>
          )}
        </>
      )}

      {dialog?.type === 'form' && <CentreFormDialog centre={dialog.centre} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.type === 'appoint' && <AppointAdminDialog centre={dialog.centre} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.type === 'adminRole' && (
        <ChangeRoleDialog
          title={`Change ${personName(dialog.centre.admin)}'s role`}
          text={`${dialog.centre.name} will have no admin until you appoint a new one.`}
          onClose={() => setDialog(null)}
          onSubmit={async (role) => done((await centreApi.changeAdminRole(dialog.centre._id, role)).data.message)}
        />
      )}
      {dialog?.type === 'unassignedRole' && (
        <ChangeRoleDialog
          title={`Change ${personName(dialog.admin)}'s role`}
          text="They'll choose their centre from their profile afterwards."
          onClose={() => setDialog(null)}
          onSubmit={async (role) => done((await centreApi.changeUnassignedAdminRole(dialog.admin._id, role)).data.message)}
        />
      )}
    </div>
  );
};

export default Centres;
