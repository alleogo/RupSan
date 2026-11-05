import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card from './Card';
import { centreApi } from '../utils/api';

// Super Admin's dashboard: platform overview and shortcuts
const Stat = ({ label, value, warn }) => (
  <Card style={{ padding: '18px 20px' }}>
    <p style={{ fontSize: '0.85rem', marginBottom: '6px' }}>{label}</p>
    <p style={{ fontSize: '1.7rem', fontWeight: 700, color: warn ? 'var(--accent-warning)' : 'var(--text-primary)' }}>{value}</p>
  </Card>
);

const Shortcut = ({ to, title, text }) => (
  <Link to={to} style={{ textDecoration: 'none' }}>
    <Card style={{ height: '100%' }}>
      <h3 style={{ marginBottom: '6px', color: 'var(--text-primary)' }}>{title} →</h3>
      <p style={{ fontSize: '0.9rem' }}>{text}</p>
    </Card>
  </Link>
);

const SuperAdminHome = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    centreApi.manage().then(res => { if (res.data.success) setData(res.data); }).catch(() => setData({ centres: [], unassignedAdmins: [] }));
  }, []);

  const centres = data?.centres || [];
  const members = centres.reduce((sum, c) => sum + c.members.Admin + c.members.Manager + c.members.Participant, 0);
  const withoutAdmin = centres.filter(c => !c.admin).length;

  return (
    <div className="animate-fade-in" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Super Admin</h1>
      <p style={{ marginBottom: '24px' }}>Every centre at a glance.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '16px', marginBottom: '24px' }}>
        <Stat label="Centres" value={data ? centres.length : '…'} />
        <Stat label="Members in centres" value={data ? members : '…'} />
        <Stat label="Centres without an admin" value={data ? withoutAdmin : '…'} warn={withoutAdmin > 0} />
        <Stat label="Admins without a centre" value={data ? data.unassignedAdmins.length : '…'} warn={data?.unassignedAdmins.length > 0} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '16px' }}>
        <Shortcut to="/centres" title="Centres" text="Add, rename or delete centres and appoint their admins." />
        <Shortcut to="/users" title="Users" text="Search everyone on the platform, by centre, role or verification." />
        <Shortcut to="/all-yatras" title="Yatras" text="Browse every yatra by centre, status, dates or keyword." />
      </div>
    </div>
  );
};

export default SuperAdminHome;
