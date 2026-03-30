import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

function CreateGroup({ username, onLogout, currency, onCurrencyChange }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogout = async () => {
    await axios.post('/api/logout');
    onLogout();
    navigate('/login');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post('/api/groups', { name, description });
      navigate('/group/' + res.data.group_id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex justify-between items-center px-6 py-4">
          <Link to="/dashboard" className="text-xl font-bold text-emerald-700 tracking-tight no-underline">
            Split & Settle
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                <span className="text-emerald-700 font-semibold text-sm">{username.charAt(0).toUpperCase()}</span>
              </div>
              <span className="text-sm text-gray-600 font-medium">{username}</span>
            </div>
            <select
              value={currency}
              onChange={(e) => onCurrencyChange(e.target.value)}
              className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent cursor-pointer hover:border-gray-300 transition-colors"
            >
              <option value="$">$ USD</option>
              <option value="₹">₹ INR</option>
              <option value="€">€ EUR</option>
              <option value="£">£ GBP</option>
              <option value="¥">¥ JPY</option>
              <option value="₩">₩ KRW</option>
              <option value="A$">A$ AUD</option>
              <option value="C$">C$ CAD</option>
            </select>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-emerald-600 hover:text-emerald-700 mb-6 flex items-center gap-1 bg-transparent border-none cursor-pointer font-medium"
        >
          ← Back to groups
        </button>

        <h2 className="text-2xl font-bold text-gray-800 mb-2">Create a Group</h2>
        <p className="text-gray-500 text-sm mb-6">Start tracking shared expenses with your friends</p>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Trip to Goa"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group for?"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
            >
              Create Group
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateGroup;
