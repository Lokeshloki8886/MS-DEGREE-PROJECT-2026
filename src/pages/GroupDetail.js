import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';

function timeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + (minutes === 1 ? ' min ago' : ' mins ago');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
  const days = Math.floor(hours / 24);
  if (days < 7) return days + (days === 1 ? ' day ago' : ' days ago');
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks + (weeks === 1 ? ' week ago' : ' weeks ago');
  return date.toLocaleDateString();
}

function ToastItem({ text, type, onClose, onUndo, id }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const duration = 7000;

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 50);
    const closeTimer = setTimeout(() => {
      setClosing(true);
      setTimeout(() => onClose(id), 500);
    }, duration);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(closeTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = () => {
    setClosing(true);
    setTimeout(() => onClose(id), 400);
  };

  const bg = type === 'error' ? 'bg-red-600' : 'bg-emerald-600';
  const barBg = type === 'error' ? 'bg-red-300' : 'bg-emerald-300';

  return (
    <div
      className={
        'w-80 shadow-2xl rounded-xl overflow-hidden transition-all ease-in-out mb-3 ' +
        bg + ' ' +
        (visible && !closing
          ? 'translate-x-0 opacity-100 duration-300'
          : 'translate-x-[120%] opacity-0 duration-500')
      }
    >
      <div className="px-5 py-4 text-white text-sm flex items-center gap-3">
        <span className="flex-1">{text}</span>
        {onUndo && (
          <button
            onClick={() => { onUndo(); dismiss(); }}
            className="font-semibold bg-white/20 px-2.5 py-1 rounded-md text-white cursor-pointer text-xs border-none hover:bg-white/30 transition-colors"
          >
            Undo
          </button>
        )}
        <button
          onClick={dismiss}
          className="bg-transparent border-none text-white cursor-pointer text-lg leading-none opacity-60 hover:opacity-100"
        >
          ×
        </button>
      </div>
      <div className="h-1 w-full bg-white/20">
        <div
          className={barBg + ' h-full'}
          style={{ animation: 'shrink ' + duration + 'ms linear forwards' }}
        />
      </div>
    </div>
  );
}

function GroupDetail({ username, onLogout, currency, onCurrencyChange }) {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [newMember, setNewMember] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigate = useNavigate();
  const suggestRef = useRef(null);
  const toastId = useRef(0);

  const [expenses, setExpenses] = useState([]);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePaidBy, setExpensePaidBy] = useState('');
  const [splitMembers, setSplitMembers] = useState([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [balances, setBalances] = useState([]);
  const [simplifiedDebts, setSimplifiedDebts] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [settleConfirm, setSettleConfirm] = useState(null);

  const isOwner = group && group.created_by === username;

  const showToast = useCallback((text, type, onUndo) => {
    toastId.current += 1;
    setToasts(prev => [...prev, { id: toastId.current, text, type, onUndo: onUndo || null }]);
  }, []);

  const removeToast = useCallback((tid) => {
    setToasts(prev => prev.filter(t => t.id !== tid));
  }, []);

  const fetchGroup = () => {
    axios.get('/api/groups/' + id)
      .then(res => {
        setGroup(res.data.group);
        setMembers(res.data.members);
      })
      .catch(err => {
        if (err.response?.status === 403) {
          navigate('/dashboard');
        }
      })
      .finally(() => setLoading(false));
  };

  const fetchExpenses = () => {
    axios.get('/api/groups/' + id + '/expenses')
      .then(res => setExpenses(res.data.expenses))
      .catch(() => { });
  };

  const fetchBalances = () => {
    axios.get('/api/groups/' + id + '/balances')
      .then(res => setBalances(res.data.balances))
      .catch(() => { });
  };

  const fetchSimplifiedDebts = () => {
    axios.get('/api/groups/' + id + '/simplified-debts')
      .then(res => setSimplifiedDebts(res.data.debts))
      .catch(() => { });
  };

  const fetchSettlements = () => {
    axios.get('/api/groups/' + id + '/settlements')
      .then(res => setSettlements(res.data.settlements))
      .catch(() => { });
  };

  useEffect(() => {
    fetchGroup();
    fetchExpenses();
    fetchBalances();
    fetchSimplifiedDebts();
    fetchSettlements();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (members.length > 0 && !expensePaidBy) {
      const currentUser = members.find(m => m.username === username);
      if (currentUser) {
        setExpensePaidBy(String(currentUser.id));
      }
    }
  }, [members, username, expensePaidBy]);

  useEffect(() => {
    if (members.length > 0 && splitMembers.length === 0) {
      setSplitMembers(members.map(m => m.id));
    }
  }, [members, splitMembers.length]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await axios.post('/api/logout');
    onLogout();
    navigate('/login');
  };

  const handleSearch = (value) => {
    setNewMember(value);
    if (value.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    axios.get('/api/users/search?q=' + value)
      .then(res => {
        const memberIds = members.map(m => m.id);
        const filtered = res.data.users.filter(u => !memberIds.includes(u.id));
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
      })
      .catch(() => setSuggestions([]));
  };

  const pickUser = (name) => {
    setNewMember(name);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await axios.post('/api/groups/' + id + '/members', { username: newMember });
      showToast(newMember + ' has been added', 'success');
      setNewMember('');
      setSuggestions([]);
      fetchGroup();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to add member', 'error');
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    setError('');
    try {
      await axios.delete('/api/groups/' + id + '/members/' + memberId);
      fetchGroup();
      showToast(memberName + ' has been removed', 'success', () => {
        axios.post('/api/groups/' + id + '/members', { username: memberName })
          .then(() => {
            fetchGroup();
            showToast(memberName + ' has been added back', 'success');
          })
          .catch(() => showToast('Could not undo', 'error'));
      });
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to remove member', 'error');
    }
  };

  const handleLeaveGroup = async () => {
    try {
      await axios.post('/api/groups/' + id + '/leave');
      navigate('/dashboard');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to leave group', 'error');
    }
  };

  const handleDeleteGroup = async () => {
    try {
      await axios.delete('/api/groups/' + id);
      navigate('/dashboard');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete group', 'error');
      setShowDeleteConfirm(false);
    }
  };

  const toggleSplitMember = (memberId) => {
    if (splitMembers.includes(memberId)) {
      if (splitMembers.length === 1) return;
      setSplitMembers(splitMembers.filter(mid => mid !== memberId));
    } else {
      setSplitMembers([...splitMembers, memberId]);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseAmount || !expensePaidBy || splitMembers.length === 0) {
      showToast('Please fill all fields', 'error');
      return;
    }
    try {
      await axios.post('/api/groups/' + id + '/expenses', {
        description: expenseDesc,
        amount: parseFloat(expenseAmount),
        paid_by: parseInt(expensePaidBy),
        split_among: splitMembers
      });
      showToast('Expense added', 'success');
      setExpenseDesc('');
      setExpenseAmount('');
      setShowExpenseForm(false);
      fetchExpenses();
      fetchBalances();
      fetchSimplifiedDebts();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to add expense', 'error');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    try {
      await axios.delete('/api/groups/' + id + '/expenses/' + expenseId);
      showToast('Expense deleted', 'success');
      fetchExpenses();
      fetchBalances();
      fetchSimplifiedDebts();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete expense', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="text-gray-400 mt-4 text-sm">Loading group...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Group not found</p>
          <Link to="/dashboard" className="text-emerald-600 text-sm mt-2 inline-block">Go back to dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`@keyframes shrink { from { width: 100%; } to { width: 0%; } }`}</style>

      <div className="fixed top-6 right-6 z-50 flex flex-col items-end">
        {toasts.map(t => (
          <ToastItem
            key={t.id}
            id={t.id}
            text={t.text}
            type={t.type}
            onUndo={t.onUndo}
            onClose={removeToast}
          />
        ))}
      </div>

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

      <div className="max-w-3xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-emerald-600 hover:text-emerald-700 mb-6 flex items-center gap-1 bg-transparent border-none cursor-pointer font-medium"
        >
          ← Back to groups
        </button>

        {/* Total Spending Widget */}
        {expenses.length > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
              <p className="text-xs text-emerald-600 font-medium mb-1">Total Group Spending</p>
              <p className="text-2xl font-bold text-emerald-700">
                {currency}{expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <p className="text-xs text-gray-500 font-medium mb-1">You Paid</p>
              <p className="text-2xl font-bold text-gray-800">
                {currency}{expenses.filter(e => e.paid_by === username).reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{group.name}</h2>
              {group.description && (
                <p className="text-gray-500 mt-2">{group.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-3">Created by {group.created_by}</p>
            </div>
            <div className="flex gap-2">
              {isOwner ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                >
                  Delete Group
                </button>
              ) : (
                <button
                  onClick={handleLeaveGroup}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-gray-200"
                >
                  Leave Group
                </button>
              )}
            </div>
          </div>

          {showDeleteConfirm && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-100">
              <p className="text-sm text-red-700 mb-3">This will permanently delete the group and all its data. Are you sure?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteGroup}
                  className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                >
                  Yes, Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-white text-gray-600 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Balance Summary */}
        {balances.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Balances
              <span className="ml-2 text-sm font-normal text-gray-400">({balances.length})</span>
            </h3>
            <div className="space-y-3">
              {balances.map((b, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-700">{b.from === username ? 'You' : b.from}</span>
                    <span className="text-gray-400">owes</span>
                    <span className="font-medium text-gray-700">{b.to === username ? 'You' : b.to}</span>
                  </div>
                  <span className="font-semibold text-red-500 text-sm">{currency}{b.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Simplified Debts - Settle Up */}
        {simplifiedDebts.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">
              Settle Up
              <span className="ml-2 text-sm font-normal text-gray-400">({simplifiedDebts.length} payment{simplifiedDebts.length !== 1 ? 's' : ''})</span>
            </h3>
            <p className="text-xs text-gray-400 mb-4">Simplified to the fewest payments possible</p>
            <div className="space-y-3">
              {simplifiedDebts.map((d, i) => (
                <div key={i} className="flex items-center justify-between py-3 px-4 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                      <span className="text-amber-700 font-semibold text-xs">{d.from_username.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="font-medium text-gray-700">{d.from_username === username ? 'You' : d.from_username}</span>
                    <span className="text-gray-400">→</span>
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                      <span className="text-emerald-700 font-semibold text-xs">{d.to_username.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="font-medium text-gray-700">{d.to_username === username ? 'You' : d.to_username}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-amber-600">{currency}{d.amount.toFixed(2)}</span>
                    {settleConfirm === i ? (
                      <div className="flex gap-1">
                        <button
                          onClick={async () => {
                            try {
                              await axios.post('/api/groups/' + id + '/settle', {
                                from_user: d.from_user,
                                to_user: d.to_user,
                                amount: d.amount
                              });
                              showToast('Payment settled!', 'success');
                              setSettleConfirm(null);
                              fetchSimplifiedDebts();
                              fetchBalances();
                              fetchSettlements();
                            } catch (err) {
                              showToast(err.response?.data?.error || 'Failed to settle', 'error');
                            }
                          }}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setSettleConfirm(null)}
                          className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSettleConfirm(i)}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                      >
                        Settle
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No debts message */}
        {expenses.length > 0 && simplifiedDebts.length === 0 && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 mb-6 text-center">
            <div className="text-3xl mb-2">🎉</div>
            <p className="text-emerald-700 font-medium">All settled up!</p>
            <p className="text-emerald-600 text-sm mt-1">No outstanding debts in this group</p>
          </div>
        )}

        {/* Settlement History */}
        {settlements.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Settlement History
              <span className="ml-2 text-sm font-normal text-gray-400">({settlements.length})</span>
            </h3>
            <div className="space-y-2">
              {settlements.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-emerald-50 border border-emerald-100">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-emerald-500 text-base">✓</span>
                    <span className="font-medium text-gray-700">{s.from_username === username ? 'You' : s.from_username}</span>
                    <span className="text-gray-400">paid</span>
                    <span className="font-medium text-gray-700">{s.to_username === username ? 'You' : s.to_username}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-emerald-600 text-sm">{currency}{s.amount.toFixed(2)}</span>
                    <span className="text-xs text-gray-400">{timeAgo(s.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Members
            <span className="ml-2 text-sm font-normal text-gray-400">({members.length})</span>
          </h3>
          <div className="space-y-1">
            {members.map(m => (
              <div
                key={m.id}
                className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-700 font-semibold text-sm">{m.username.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="text-gray-700 font-medium text-sm">{m.username}</span>
                  {m.username === group.created_by && (
                    <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Owner</span>
                  )}
                </div>
                {isOwner && m.username !== username && (
                  <button
                    onClick={() => handleRemoveMember(m.id, m.username)}
                    className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded transition-colors bg-transparent border-none cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Add Member</h3>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleAddMember} className="flex gap-3">
            <div className="flex-1 relative" ref={suggestRef}>
              <input
                type="text"
                value={newMember}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                placeholder="Start typing a username..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
                required
              />
              {showSuggestions && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                  {suggestions.map(user => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => pickUser(user.username)}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 transition-colors border-none bg-transparent cursor-pointer"
                    >
                      <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-emerald-700 font-semibold text-xs">{user.username.charAt(0).toUpperCase()}</span>
                      </div>
                      {user.username}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
            >
              Add
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Expenses
              <span className="ml-2 text-sm font-normal text-gray-400">({expenses.length})</span>
            </h3>
            <div className="flex gap-2">
              {expenses.length > 0 && (
                <button
                  onClick={() => {
                    const header = 'Description,Amount,Paid By,Date\n';
                    const rows = expenses.map(e =>
                      '"' + (e.description || 'Untitled') + '",' + e.amount.toFixed(2) + ',' + e.paid_by + ',"' + e.created_at + '"'
                    ).join('\n');
                    const blob = new Blob([header + rows], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = (group.name || 'expenses') + '_expenses.csv';
                    link.click();
                    URL.revokeObjectURL(url);
                    showToast('CSV downloaded', 'success');
                  }}
                  className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Export CSV
                </button>
              )}
              <button
                onClick={() => setShowExpenseForm(!showExpenseForm)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
              >
                {showExpenseForm ? 'Cancel' : '+ Add Expense'}
              </button>
            </div>
          </div>

          {showExpenseForm && (
            <form onSubmit={handleAddExpense} className="bg-gray-50 rounded-xl p-5 mb-5 space-y-4 border border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
                <input
                  type="text"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="e.g. Dinner, Cab fare"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Amount ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Paid by</label>
                <select
                  value={expensePaidBy}
                  onChange={(e) => setExpensePaidBy(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition bg-white"
                >
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.username}{m.username === username ? ' (you)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Split among</label>
                <div className="flex flex-wrap gap-2">
                  {members.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleSplitMember(m.id)}
                      className={
                        'px-3 py-1.5 rounded-full text-sm font-medium transition-colors border cursor-pointer ' +
                        (splitMembers.includes(m.id)
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                          : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300')
                      }
                    >
                      {m.username}
                    </button>
                  ))}
                </div>
                {splitMembers.length > 0 && expenseAmount && (
                  <p className="text-xs text-gray-400 mt-2">
                    {currency}{(parseFloat(expenseAmount) / splitMembers.length).toFixed(2)} per person
                  </p>
                )}
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Add Expense
              </button>
            </form>
          )}

          {expenses.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">💸</div>
              <p className="text-gray-400 text-sm">No expenses yet. Add your first one!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {expenses.map(expense => (
                <div key={expense.id} className="border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-800">{expense.description || 'Untitled expense'}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        <span className="font-medium text-emerald-600">{expense.paid_by}</span> paid {currency}{expense.amount.toFixed(2)}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {expense.splits.map(s => (
                          <span key={s.user_id} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                            {s.username}: {currency}{s.amount.toFixed(2)}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-300 mt-2">{timeAgo(expense.created_at)}</p>
                    </div>
                    {expense.paid_by === username && (
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded transition-colors bg-transparent border-none cursor-pointer"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GroupDetail;
