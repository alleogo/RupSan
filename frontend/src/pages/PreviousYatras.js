import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { Link } from 'react-router-dom';
import { yatraApi, getMediaUrl } from '../utils/api';

const PreviousYatras = () => {
  const [pastYatras, setPastYatras] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const yatrasRes = await yatraApi.getAll();
        if (yatrasRes.data.success) {
          setPastYatras(yatrasRes.data.yatras.filter(y => y.status === 'Completed'));
        }
      } catch (error) {
        console.error("Failed to fetch past yatras:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const YatraCard = ({ yatra }) => (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {yatra.thumbnail ? (
        <img src={getMediaUrl(yatra.thumbnail)} alt={yatra.title}
          style={{ width: '100%', height: '150px', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ width: '100%', height: '100px', background: 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(16,185,129,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '2.5rem' }}>🛕</span>
        </div>
      )}
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '1.1rem', flex: 1 }}>{yatra.title}</h3>
          <span style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', marginLeft: '8px', whiteSpace: 'nowrap' }}>
            Completed
          </span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>📍 {yatra.destination}</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>
          📅 {new Date(yatra.startDate).toLocaleDateString()} – {new Date(yatra.endDate).toLocaleDateString()}
        </p>
        {yatra.createdBy && (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>
            👤 Manager: {yatra.createdBy.firstName} {yatra.createdBy.lastName}
          </p>
        )}
        <div style={{ marginTop: '14px' }}>
          <Link to={`/yatra/${yatra._id}`} style={{ textDecoration: 'none' }}>
            <Button variant="default">View Details</Button>
          </Link>
        </div>
      </div>
    </Card>
  );

  if (loading) return <div style={{ padding: '24px', textAlign: 'center' }}>Loading...</div>;

  return (
    <div className="animate-fade-in" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>📜 Previous Yatras</h1>
      <p style={{ marginBottom: '32px' }}>View all past and completed yatras.</p>
      
      {pastYatras.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {pastYatras.map(y => <YatraCard key={y._id} yatra={y} />)}
        </div>
      ) : (
        <p style={{ color: 'var(--text-secondary)' }}>No completed yatras found.</p>
      )}
    </div>
  );
};

export default PreviousYatras;
