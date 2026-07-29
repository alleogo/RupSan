import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import YatraDetails from './pages/YatraDetails';
import Profile from './pages/Profile';
import PreviousYatras from './pages/PreviousYatras';
import YatraManagement from './pages/YatraManagement';
import Ledger from './pages/Ledger';
import { AuthProvider } from './context/AuthContext';
import BackgroundDesign from './components/BackgroundDesign';
import './index.css';

const AppContent = () => {
  const location = useLocation();
  
  return (
    <div className="app-container">
      <div key={location.pathname + '-bg'} className="animate-bg-fade">
        <BackgroundDesign />
      </div>
      <Navbar />
      <main key={location.pathname} className="animate-page-fade">
        <Routes location={location}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/yatra/:id" element={<YatraDetails />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/previous-yatras" element={<PreviousYatras />} />
          <Route path="/yatra-management" element={<YatraManagement />} />
          <Route path="/ledger" element={<Ledger />} />
        </Routes>
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
