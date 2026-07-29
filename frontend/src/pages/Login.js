import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const result = await login(formData.email, formData.password);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '20px' }}>
      <div style={{ maxWidth: '400px', width: '100%' }}>
        <Card>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h2 style={{ marginBottom: '8px' }}>Welcome Back</h2>
            <p>Enter your credentials to access your account.</p>
          </div>
          
          {error && <div style={{ color: 'var(--accent-danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '4px', marginBottom: '16px', textAlign: 'center' }}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <Input 
              label="Email Address" 
              type="email" 
              name="email"
              value={formData.email} 
              onChange={handleChange} 
              placeholder="you@example.com" 
              required 
            />
            <Input 
              label="Password" 
              type="password" 
              name="password"
              value={formData.password} 
              onChange={handleChange} 
              placeholder="••••••••" 
              required 
            />
            <Button type="submit" style={{ marginTop: '16px' }} disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
            </Button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <p style={{ fontSize: '0.9rem' }}>
              Don't have an account? <Link to="/register" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>Sign up</Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;
