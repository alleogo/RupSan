import React, { useState, useEffect, useContext } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { transactionApi } from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Ledger = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpense: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [editingId, setEditingId] = useState(null);

  // Filter states
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    category: '',
    type: '',
    page: 1,
    limit: 20
  });

  // Form states
  const [formData, setFormData] = useState({
    type: 'Expense',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!user || (user.role !== 'Admin' && user.role !== 'Manager')) {
      navigate('/');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async (filterParams = filters) => {
    try {
      setLoading(true);
      const [transRes, summRes, catRes] = await Promise.all([
        transactionApi.getAll(filterParams),
        transactionApi.getSummary(filterParams),
        transactionApi.getCategories()
      ]);

      if (transRes.data.success) {
        setTransactions(transRes.data.transactions);
      }
      if (summRes.data.success) {
        setSummary(summRes.data.summary);
      }
      if (catRes.data.success) {
        setCategories(catRes.data.categories);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    const newFilters = { ...filters, [name]: value, page: 1 };
    setFilters(newFilters);
    fetchData(newFilters);
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    try {
      const res = await transactionApi.add({
        ...formData,
        amount: parseFloat(formData.amount)
      });

      if (res.data.success) {
        setIsModalOpen(false);
        setFormData({
          type: 'Expense',
          amount: '',
          description: '',
          date: new Date().toISOString().split('T')[0]
        });
        fetchData(filters);
      }
    } catch (error) {
      console.error('Failed to add transaction:', error);
    }
  };

  const handleEditTransaction = async (e) => {
    e.preventDefault();
    try {
      const res = await transactionApi.update(editingId, {
        ...formData,
        amount: parseFloat(formData.amount)
      });

      if (res.data.success) {
        setIsEditModalOpen(false);
        setEditingId(null);
        setFormData({
          type: 'Expense',
          amount: '',
          description: '',
          date: new Date().toISOString().split('T')[0]
        });
        fetchData(filters);
      }
    } catch (error) {
      console.error('Failed to update transaction:', error);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;

    try {
      const res = await transactionApi.delete(id);
      if (res.data.success) {
        fetchData(filters);
      }
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    }
  };

  const openEditModal = (transaction) => {
    setEditingId(transaction._id);
    setFormData({
      type: transaction.type,
      amount: transaction.amount.toString(),
      description: transaction.description,
      date: new Date(transaction.date).toISOString().split('T')[0]
    });
    setIsEditModalOpen(true);
  };

  return (
    <div className="animate-fade-in" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>💰 Ledger Management</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Track income and expenses</p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <Card>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Total Income</p>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--accent-success)' }}>
            ₹{summary.totalIncome.toLocaleString()}
          </p>
        </Card>

        <Card>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Total Expenses</p>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--accent-danger)' }}>
            ₹{summary.totalExpense.toLocaleString()}
          </p>
        </Card>

        <Card>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Balance</p>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--accent-primary)' }}>
            ₹{summary.balance.toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Filters & Add Button */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Transactions</h2>
          <Button onClick={() => setIsModalOpen(true)}>+ Add Transaction</Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Start Date</label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="input-field"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>End Date</label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="input-field"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Type</label>
            <select
              name="type"
              value={filters.type}
              onChange={handleFilterChange}
              className="input-field"
              style={{ width: '100%' }}
            >
              <option value="">All Types</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Category</label>
            <select
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
              className="input-field"
              style={{ width: '100%' }}
            >
              <option value="">All Categories</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Transactions Table */}
      <Card>
        {loading ? (
          <p>Loading transactions...</p>
        ) : transactions.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No transactions found</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Date</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Type</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Category</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Description</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: '600', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Recorded By</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px' }}>{new Date(t.date).toLocaleDateString()}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: t.type === 'Income' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        color: t.type === 'Income' ? 'var(--accent-success)' : 'var(--accent-danger)',
                        fontSize: '0.85rem',
                        fontWeight: '600'
                      }}>
                        {t.type}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '0.9rem' }}>{t.category}</td>
                    <td style={{ padding: '12px', fontSize: '0.9rem' }}>{t.description}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: t.type === 'Income' ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                      {t.type === 'Income' ? '+' : '-'}₹{t.amount.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', fontSize: '0.9rem' }}>{t.recordedBy?.firstName} {t.recordedBy?.lastName}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        onClick={() => openEditModal(t)}
                        style={{
                          padding: '4px 8px',
                          marginRight: '4px',
                          background: 'rgba(99,102,241,0.1)',
                          border: 'none',
                          borderRadius: '4px',
                          color: 'var(--accent-primary)',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: '600'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTransaction(t._id)}
                        style={{
                          padding: '4px 8px',
                          background: 'rgba(239,68,68,0.1)',
                          border: 'none',
                          borderRadius: '4px',
                          color: 'var(--accent-danger)',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: '600'
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Transaction Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="animate-fade-in" style={{
            width: '100%',
            maxWidth: '500px',
            background: 'var(--bg-secondary)',
            padding: '24px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--glass-border)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginBottom: '16px' }}>Add Transaction</h2>
            <form onSubmit={handleAddTransaction}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="Income">Income</option>
                  <option value="Expense">Expense</option>
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="input-field"
                  placeholder="Enter amount"
                  required
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  placeholder="Enter description"
                  rows="3"
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <Button type="submit" variant="primary" style={{ flex: 1 }}>Add Transaction</Button>
                <Button
                  type="button"
                  variant="default"
                  onClick={() => setIsModalOpen(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {isEditModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="animate-fade-in" style={{
            width: '100%',
            maxWidth: '500px',
            background: 'var(--bg-secondary)',
            padding: '24px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--glass-border)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginBottom: '16px' }}>Edit Transaction</h2>
            <form onSubmit={handleEditTransaction}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="Income">Income</option>
                  <option value="Expense">Expense</option>
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="input-field"
                  placeholder="Enter amount"
                  required
                />
              </div>


              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  placeholder="Enter description"
                  rows="3"
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <Button type="submit" variant="primary" style={{ flex: 1 }}>Update Transaction</Button>
                <Button
                  type="button"
                  variant="default"
                  onClick={() => setIsEditModalOpen(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ledger;
