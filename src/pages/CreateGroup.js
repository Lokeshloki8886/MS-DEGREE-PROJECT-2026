import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AppShell from '../components/AppShell';

export default function CreateGroup({ username, onLogout, currency, onCurrencyChange }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogout = async () => {
    await axios.post('/api/logout');
    onLogout();
    navigate('/login');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      const response = await axios.post('/api/groups', { name, description });
      navigate(`/group/${response.data.group_id}`);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to create group');
    }
  };

  return (
    <AppShell
      username={username}
      currency={currency}
      onCurrencyChange={onCurrencyChange}
      onLogout={handleLogout}
      navItems={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Create Group', to: '/create-group', active: true },
        { label: 'Workspace', disabled: true }
      ]}
      pageIntro={{
        eyebrow: 'New group',
        title: 'Set up a premium workspace for a new split.',
        description: 'Create the group once, then add members, log expenses, and settle balances inside the same polished layout.',
        actions: (
          <div className="button-row">
            <button type="button" className="button button--secondary" onClick={() => navigate('/dashboard')}>
              Back to dashboard
            </button>
          </div>
        )
      }}
    >
      <div className="page-columns">
        <section className="surface group-form-grid">
          <div className="section-header">
            <div>
              <h2 className="section-title">Group details</h2>
              <p className="section-copy">Keep the name clear so your group is easy to find later.</p>
            </div>
          </div>

          {error && <div className="notice notice--error">{error}</div>}

          <form onSubmit={handleSubmit} className="form-grid">
            <div className="field">
              <label className="field__label" htmlFor="group-name">Group name</label>
              <input
                id="group-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="input"
                placeholder="Weekend trip, flatmates, team lunch"
                required
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="group-description">Description</label>
              <textarea
                id="group-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="textarea"
                placeholder="Add a short note about what this group covers."
              />
            </div>

            <div className="button-row">
              <button type="submit" className="button button--primary">
                Create group
              </button>
              <button type="button" className="button button--ghost" onClick={() => navigate('/dashboard')}>
                Cancel
              </button>
            </div>
          </form>
        </section>

        <aside className="surface info-card">
          <p className="eyebrow">What happens next</p>
          <h2 className="section-title">A cleaner group flow from day one.</h2>
          <p className="section-copy">
            Once the group is created you can add members, enter expenses, and start settling from the same premium workspace.
          </p>

          <div className="info-grid">
            <div className="info-tile">
              <span className="field__hint">Owner</span>
              <strong>{username}</strong>
            </div>
            <div className="info-tile">
              <span className="field__hint">Currency</span>
              <strong>{currency}</strong>
            </div>
          </div>

          <ul>
            <li>The group creator becomes the owner.</li>
            <li>The owner is added to the group automatically.</li>
            <li>Expenses, balances, and settlement history stay linked to this group.</li>
          </ul>
        </aside>
      </div>
    </AppShell>
  );
}
