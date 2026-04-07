import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { classNames } from '../lib/ui';
import AuthLayout from '../components/AuthLayout';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [available, setAvailable] = useState(null);
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!username.trim()) {
      setAvailable(null);
      return undefined;
    }

    setChecking(true);
    const timer = window.setTimeout(() => {
      axios.get(`/api/check-username?username=${encodeURIComponent(username)}`)
        .then((response) => setAvailable(response.data.available))
        .catch(() => setAvailable(null))
        .finally(() => setChecking(false));
    }, 350);

    return () => window.clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      await axios.post('/api/register', { username, password });
      setSuccess('Account created. Redirecting to login...');
      window.setTimeout(() => navigate('/login'), 1400);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <AuthLayout
      eyebrow="Create account"
      title="Build your expense space once, then keep every split organized."
      subtitle="Register with a username and password. The app keeps the logic simple while the interface stays polished."
      footer={(
        <p>
          Already registered?{' '}
          <Link to="/login" className="text-link">
            Sign in
          </Link>
        </p>
      )}
    >
      <form onSubmit={handleSubmit} className="form-grid">
        {error && <div className="notice notice--error">{error}</div>}
        {success && <div className="notice notice--success">{success}</div>}

        <div className="field">
          <label className="field__label" htmlFor="register-username">Username</label>
          <input
            id="register-username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="input"
            placeholder="Choose a username"
            required
          />
          {username.trim() && (
            <p
              className={classNames(
                'field__hint',
                checking ? '' : available ? 'field__hint--success' : 'field__hint--error'
              )}
            >
              {checking ? 'Checking availability...' : available ? 'Username is available' : 'Username is already taken'}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input"
            placeholder="Create a password"
            required
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="register-confirm-password">Confirm password</label>
          <input
            id="register-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="input"
            placeholder="Repeat the password"
            required
          />
        </div>

        <button type="submit" className="button button--primary button--block" disabled={available === false}>
          Create Account
        </button>
      </form>
    </AuthLayout>
  );
}

