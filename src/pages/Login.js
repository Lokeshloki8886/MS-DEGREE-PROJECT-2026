import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthLayout from '../components/AuthLayout';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      const response = await axios.post('/api/login', { username, password });
      onLogin(response.data.username);
      navigate('/dashboard');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Login failed');
    }
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Shared expenses with a clearer, calmer workspace."
      subtitle="Sign in to review balances, jump into your groups, and settle what matters."
      footer={(
        <p>
          Need an account?{' '}
          <Link to="/register" className="text-link">
            Create one
          </Link>
        </p>
      )}
    >
      <form onSubmit={handleSubmit} className="form-grid">
        {error && <div className="notice notice--error">{error}</div>}

        <div className="field">
          <label className="field__label" htmlFor="login-username">Username</label>
          <input
            id="login-username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="input"
            placeholder="Enter your username"
            required
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input"
            placeholder="Enter your password"
            required
          />
        </div>

        <div className="button-row">
          <button type="submit" className="button button--primary button--block">
            Sign In
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}

