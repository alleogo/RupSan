import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useContext(AuthContext);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'Participant',
    adminSecret: '',
    otp: ''
  });

  // Need api to send OTP
  const api = require('../utils/api').default;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (!otpSent) {
      try {
        const response = await api.post('/auth/sendotp', { email: formData.email });
        if (response.data.success) {
          setSuccessMsg("OTP sent to your email!");
          setOtpSent(true);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to send OTP');
      }
    } else {
      const result = await register(formData);
      if (result.success) {
        setSuccessMsg(result.message + ' Redirecting to login...');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(result.message);
      }
    }
    setLoading(false);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '20px', margin: '40px 0' }}>
      <div style={{ maxWidth: '500px', width: '100%' }}>
        <Card>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h2 style={{ marginBottom: '8px' }}>Create an Account</h2>
            <p>Join the platform to manage yatras and accounts.</p>
          </div>
          
          {error && <div style={{ color: 'var(--accent-danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '4px', marginBottom: '16px', textAlign: 'center' }}>{error}</div>}
          {successMsg && <div style={{ color: 'var(--accent-success)', background: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '4px', marginBottom: '16px', textAlign: 'center' }}>{successMsg}</div>}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <Input label="First Name" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="John" required />
              <Input label="Last Name" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Doe" required />
            </div>
            
            <Input label="Email Address" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" required />
            <Input label="Password" type="password" name="password" value={formData.password} onChange={handleChange} placeholder="••••••••" required />
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Role</label>
              <select 
                name="role" 
                value={formData.role} 
                onChange={handleChange} 
                className="input-field" 
                style={{ cursor: 'pointer' }}
              >
                <option value="Participant">Participant</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            {formData.role === 'Admin' && (
              <Input 
                label="Admin Secret Key" 
                type="password" 
                name="adminSecret" 
                value={formData.adminSecret} 
                onChange={handleChange} 
                placeholder="Enter secret to register as Admin" 
                required 
              />
            )}
            
            {formData.role === 'Manager' && (
              <p style={{ fontSize: '0.85rem', color: 'var(--accent-warning)', marginBottom: '16px', background: 'rgba(245, 158, 11, 0.1)', padding: '8px', borderRadius: '4px' }}>
                Note: Manager accounts require Admin approval before you can log in.
              </p>
            )}

            {otpSent && (
              <Input 
                label="OTP Verification Code" 
                name="otp" 
                value={formData.otp} 
                onChange={handleChange} 
                placeholder="123456" 
                required 
              />
            )}

            <Button type="submit" style={{ marginTop: '8px' }} disabled={loading}>
              {loading ? 'Processing...' : (otpSent ? 'Verify & Sign Up' : 'Send OTP')}
            </Button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <p style={{ fontSize: '0.9rem' }}>
              Already have an account? <Link to="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>Log in</Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Register;
