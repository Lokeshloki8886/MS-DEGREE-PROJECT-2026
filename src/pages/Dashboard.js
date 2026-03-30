import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

function Dashboard({ username, onLogout, currency, onCurrencyChange }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupDebts, setGroupDebts] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/groups')
      .then(res => {
        setGroups(res.data.groups);
        for (const g of res.data.groups) {
          axios.get('/api/groups/' + g.id + '/simplified-debts')
            .then(r => {
              setGroupDebts(prev => ({ ...prev, [g.id]: r.data.debts }));
            })
            .catch(() => { });
        }
      })
      .catch(err => console.log(err))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await axios.post('/api/logout');
    onLogout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex justify-between items-center px-6 py-4">
          <Link to="/dashboard" className="text-xl font-bold text-emerald-700 tracking-tight no-underline">Split & Settle</Link>
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

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Personal balance overview */}
        {groups.length > 0 && Object.keys(groupDebts).length > 0 && (() => {
          let totalYouOwe = 0;
          let totalOwedToYou = 0;
          for (const gid of Object.keys(groupDebts)) {
            const debts = groupDebts[gid] || [];
            for (const d of debts) {
              if (d.from_username === username) totalYouOwe += d.amount;
              if (d.to_username === username) totalOwedToYou += d.amount;
            }
          }
          if (totalYouOwe === 0 && totalOwedToYou === 0) return null;
          return (
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
                <p className="text-xs text-red-500 font-medium mb-1">You Owe</p>
                <p className="text-2xl font-bold text-red-600">{currency}{totalYouOwe.toFixed(2)}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                <p className="text-xs text-emerald-600 font-medium mb-1">You Are Owed</p>
                <p className="text-2xl font-bold text-emerald-700">{currency}{totalOwedToYou.toFixed(2)}</p>
              </div>
            </div>
          );
        })()}

        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Your Groups</h2>
            <p className="text-gray-500 text-sm mt-1">Manage and track your shared expenses</p>
          </div>
          <Link
            to="/create-group"
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm no-underline"
          >
            + New Group
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            <p className="text-gray-400 mt-4 text-sm">Loading your groups...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-gray-500 text-lg font-medium">No groups yet</p>
            <p className="text-gray-400 text-sm mt-2 mb-6">Create your first group to start splitting expenses</p>
            <Link
              to="/create-group"
              className="inline-block px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors no-underline"
            >
              Create your first group
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {groups.map(group => {
              const debts = groupDebts[group.id] || [];
              let youOwe = 0;
              let owedToYou = 0;
              for (const d of debts) {
                if (d.from_username === username) youOwe += d.amount;
                if (d.to_username === username) owedToYou += d.amount;
              }

              return (
                <Link
                  key={group.id}
                  to={'/group/' + group.id}
                  className="block bg-white p-6 rounded-xl border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all no-underline group"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 group-hover:text-emerald-700 transition-colors">
                        {group.name}
                      </h3>
                      {group.description && (
                        <p className="text-sm text-gray-500 mt-1">{group.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      {youOwe > 0 && (
                        <span className="text-xs font-medium text-red-500 bg-red-50 px-2.5 py-1 rounded-full">
                          you owe {currency}{youOwe.toFixed(2)}
                        </span>
                      )}
                      {owedToYou > 0 && (
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                          owed {currency}{owedToYou.toFixed(2)}
                        </span>
                      )}
                      <span className="bg-gray-100 px-3 py-1 rounded-full text-xs font-medium">
                        {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                      </span>
                      <span className="text-gray-300 group-hover:text-emerald-500 transition-colors text-lg">→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
