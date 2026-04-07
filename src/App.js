import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import './App.css';
import { ThemeProvider } from './context/ThemeContext';
import { normalizeCurrency } from './lib/ui';
import CreateGroup from './pages/CreateGroup';
import Dashboard from './pages/Dashboard';
import GroupDetail from './pages/GroupDetail';
import Login from './pages/Login';
import Register from './pages/Register';

function AppRoutes() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState(() => {
    if (typeof window === 'undefined') {
      return '$';
    }

    return normalizeCurrency(window.localStorage.getItem('currency'));
  });

  const handleCurrencyChange = (value) => {
    const nextCurrency = normalizeCurrency(value);
    setCurrency(nextCurrency);
    window.localStorage.setItem('currency', nextCurrency);
  };

  useEffect(() => {
    axios.get('/api/me')
      .then((response) => setUser(response.data.username))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="app-root">
        <div className="page-shell">
          <div className="surface loading-panel">
            <p className="eyebrow">Loading</p>
            <h1 className="page-title">Preparing your workspace</h1>
            <p className="page-copy">Checking your session and restoring your preferred theme.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" /> : <Login onLogin={setUser} />}
        />
        <Route
          path="/register"
          element={user ? <Navigate to="/dashboard" /> : <Register />}
        />
        <Route
          path="/dashboard"
          element={user ? (
            <Dashboard
              username={user}
              onLogout={() => setUser(null)}
              currency={currency}
              onCurrencyChange={handleCurrencyChange}
            />
          ) : <Navigate to="/login" />}
        />
        <Route
          path="/create-group"
          element={user ? (
            <CreateGroup
              username={user}
              onLogout={() => setUser(null)}
              currency={currency}
              onCurrencyChange={handleCurrencyChange}
            />
          ) : <Navigate to="/login" />}
        />
        <Route
          path="/group/:id"
          element={user ? (
            <GroupDetail
              username={user}
              onLogout={() => setUser(null)}
              currency={currency}
              onCurrencyChange={handleCurrencyChange}
            />
          ) : <Navigate to="/login" />}
        />
        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} />} />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppRoutes />
    </ThemeProvider>
  );
}
