import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateGroup from './pages/CreateGroup';
import GroupDetail from './pages/GroupDetail';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState(() => localStorage.getItem('currency') || '$');

  const handleCurrencyChange = (value) => {
    setCurrency(value);
    localStorage.setItem('currency', value);
  };

  useEffect(() => {
    axios.get('/api/me')
      .then(res => setUser(res.data.username))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center p-12 text-lg">Loading...</div>;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" /> : <Login onLogin={setUser} />
        } />
        <Route path="/register" element={
          user ? <Navigate to="/dashboard" /> : <Register />
        } />
        <Route path="/dashboard" element={
          user ? <Dashboard username={user} onLogout={() => setUser(null)} currency={currency} onCurrencyChange={handleCurrencyChange} /> : <Navigate to="/login" />
        } />
        <Route path="/create-group" element={
          user ? <CreateGroup username={user} onLogout={() => setUser(null)} currency={currency} onCurrencyChange={handleCurrencyChange} /> : <Navigate to="/login" />
        } />
        <Route path="/group/:id" element={
          user ? <GroupDetail username={user} onLogout={() => setUser(null)} currency={currency} onCurrencyChange={handleCurrencyChange} /> : <Navigate to="/login" />
        } />
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;
