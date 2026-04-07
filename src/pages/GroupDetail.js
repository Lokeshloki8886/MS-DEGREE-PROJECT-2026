import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import AppShell from '../components/AppShell';
import Modal from '../components/Modal';
import ToastStack from '../components/ToastStack';
import {
  classNames,
  formatCompactDate,
  formatCurrency,
  formatDateTime,
  formatLongDate,
  getInitials,
  timeAgo
} from '../lib/ui';

function getMemberSnapshot(member, debts) {
  let owes = 0;
  let owed = 0;

  debts.forEach((debt) => {
    if (debt.from_user === member.id) {
      owes += debt.amount;
    }

    if (debt.to_user === member.id) {
      owed += debt.amount;
    }
  });

  return {
    ...member,
    owes,
    owed,
    net: owed - owes
  };
}

function getMemberStatus(member) {
  if (member.net > 0) {
    return {
      label: 'Gets back',
      value: member.owed,
      className: 'status-badge status-badge--owed'
    };
  }

  if (member.net < 0) {
    return {
      label: 'Owes',
      value: member.owes,
      className: 'status-badge status-badge--owe'
    };
  }

  return {
    label: 'Settled',
    value: 0,
    className: 'status-badge status-badge--settled'
  };
}

function buildCsv(expenses) {
  const header = 'Description,Amount,Paid By,Split Count,Created\n';
  const rows = expenses.map((expense) => (
    `"${(expense.description || 'Untitled expense').replace(/"/g, '""')}",${expense.amount.toFixed(2)},${expense.paid_by},${expense.splits.length},"${expense.created_at}"`
  ));

  return header + rows.join('\n');
}

export default function GroupDetail({ username, onLogout, currency, onCurrencyChange }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [simplifiedDebts, setSimplifiedDebts] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [toasts, setToasts] = useState([]);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const [memberName, setMemberName] = useState('');
  const [memberSuggestions, setMemberSuggestions] = useState([]);
  const [memberError, setMemberError] = useState('');
  const [expenseError, setExpenseError] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePaidBy, setExpensePaidBy] = useState('');
  const [splitMembers, setSplitMembers] = useState([]);

  const isOwner = group?.created_by === username;

  const resetExpenseForm = (memberList = members) => {
    const currentUser = memberList.find((member) => member.username === username);
    setExpenseDescription('');
    setExpenseAmount('');
    setExpenseError('');
    setExpensePaidBy(memberList.length ? String(currentUser?.id || memberList[0].id) : '');
    setSplitMembers(memberList.map((member) => member.id));
  };

  useEffect(() => {
    let active = true;

    async function loadGroupBundle() {
      setLoading(true);

      const responses = await Promise.allSettled([
        axios.get(`/api/groups/${id}`),
        axios.get(`/api/groups/${id}/expenses`),
        axios.get(`/api/groups/${id}/balances`),
        axios.get(`/api/groups/${id}/simplified-debts`),
        axios.get(`/api/groups/${id}/settlements`)
      ]);

      if (!active) {
        return;
      }

      const [groupResult, expensesResult, balancesResult, debtsResult, settlementsResult] = responses;

      if (groupResult.status === 'rejected') {
        const status = groupResult.reason?.response?.status;

        if (status === 403) {
          navigate('/dashboard');
          return;
        }

        setPageError(groupResult.reason?.response?.data?.error || 'Group not found');
        setGroup(null);
        setMembers([]);
        setExpenses([]);
        setBalances([]);
        setSimplifiedDebts([]);
        setSettlements([]);
        setLoading(false);
        return;
      }

      setPageError('');
      setGroup(groupResult.value.data.group);
      setMembers(groupResult.value.data.members || []);
      setExpenses(expensesResult.status === 'fulfilled' ? expensesResult.value.data.expenses : []);
      setBalances(balancesResult.status === 'fulfilled' ? balancesResult.value.data.balances : []);
      setSimplifiedDebts(debtsResult.status === 'fulfilled' ? debtsResult.value.data.debts : []);
      setSettlements(settlementsResult.status === 'fulfilled' ? settlementsResult.value.data.settlements : []);
      setLoading(false);
    }

    loadGroupBundle();

    return () => {
      active = false;
    };
  }, [id, navigate]);

  useEffect(() => {
    if (!members.length) {
      return;
    }

    if (!expensePaidBy || !members.some((member) => String(member.id) === String(expensePaidBy))) {
      const currentUser = members.find((member) => member.username === username);
      setExpensePaidBy(String(currentUser?.id || members[0].id));
    }

    setSplitMembers((current) => {
      const validMembers = current.filter((memberId) => members.some((member) => member.id === memberId));
      return validMembers.length ? validMembers : members.map((member) => member.id);
    });
  }, [members, expensePaidBy, username]);

  const pushToast = (title, message = '', tone = 'neutral') => {
    setToasts((current) => [
      ...current,
      {
        id: Date.now() + Math.random(),
        title,
        message,
        tone
      }
    ]);
  };

  const dismissToast = (toastId) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  };

  const refreshGroupData = async () => {
    setLoading(true);

    const responses = await Promise.allSettled([
      axios.get(`/api/groups/${id}`),
      axios.get(`/api/groups/${id}/expenses`),
      axios.get(`/api/groups/${id}/balances`),
      axios.get(`/api/groups/${id}/simplified-debts`),
      axios.get(`/api/groups/${id}/settlements`)
    ]);

    const [groupResult, expensesResult, balancesResult, debtsResult, settlementsResult] = responses;

    if (groupResult.status === 'fulfilled') {
      setGroup(groupResult.value.data.group);
      setMembers(groupResult.value.data.members || []);
    }

    setExpenses(expensesResult.status === 'fulfilled' ? expensesResult.value.data.expenses : []);
    setBalances(balancesResult.status === 'fulfilled' ? balancesResult.value.data.balances : []);
    setSimplifiedDebts(debtsResult.status === 'fulfilled' ? debtsResult.value.data.debts : []);
    setSettlements(settlementsResult.status === 'fulfilled' ? settlementsResult.value.data.settlements : []);
    setLoading(false);
  };

  const handleLogout = async () => {
    await axios.post('/api/logout');
    onLogout();
    navigate('/login');
  };

  const handleSearchUsers = async (value) => {
    setMemberName(value);
    setMemberError('');

    if (!value.trim()) {
      setMemberSuggestions([]);
      return;
    }

    try {
      const response = await axios.get(`/api/users/search?q=${encodeURIComponent(value)}`);
      const currentMemberIds = members.map((member) => member.id);
      setMemberSuggestions(response.data.users.filter((user) => !currentMemberIds.includes(user.id)));
    } catch (error) {
      setMemberSuggestions([]);
    }
  };

  const handleAddMember = async (event) => {
    event.preventDefault();
    setMemberError('');

    try {
      await axios.post(`/api/groups/${id}/members`, { username: memberName });
      pushToast('Member added', `${memberName} is now part of this group.`, 'success');
      setMemberName('');
      setMemberSuggestions([]);
      setShowMemberModal(false);
      await refreshGroupData();
    } catch (error) {
      setMemberError(error.response?.data?.error || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (member) => {
    try {
      await axios.delete(`/api/groups/${id}/members/${member.id}`);
      pushToast('Member removed', `${member.username} was removed from the group.`, 'success');
      await refreshGroupData();
    } catch (error) {
      pushToast('Could not remove member', error.response?.data?.error || 'Try again.', 'error');
    }
  };

  const toggleSplitMember = (memberId) => {
    if (splitMembers.includes(memberId)) {
      if (splitMembers.length === 1) {
        return;
      }

      setSplitMembers(splitMembers.filter((currentId) => currentId !== memberId));
      return;
    }

    setSplitMembers([...splitMembers, memberId]);
  };

  const handleAddExpense = async (event) => {
    event.preventDefault();
    setExpenseError('');

    if (!expenseAmount || !expensePaidBy || !splitMembers.length) {
      setExpenseError('Amount, payer, and at least one split member are required.');
      return;
    }

    try {
      await axios.post(`/api/groups/${id}/expenses`, {
        description: expenseDescription,
        amount: parseFloat(expenseAmount),
        paid_by: parseInt(expensePaidBy, 10),
        split_among: splitMembers
      });

      pushToast('Expense added', 'The new expense is now part of this group.', 'success');
      resetExpenseForm();
      setShowExpenseModal(false);
      await refreshGroupData();
    } catch (error) {
      setExpenseError(error.response?.data?.error || 'Failed to add expense');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    try {
      await axios.delete(`/api/groups/${id}/expenses/${expenseId}`);
      pushToast('Expense deleted', 'The expense was removed from this group.', 'success');
      await refreshGroupData();
    } catch (error) {
      pushToast('Could not delete expense', error.response?.data?.error || 'Try again.', 'error');
    }
  };

  const handleExportCsv = () => {
    const blob = new Blob([buildCsv(expenses)], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${group?.name || 'group'}_expenses.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    pushToast('CSV exported', 'Expense data was downloaded successfully.', 'success');
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) {
      return;
    }

    try {
      if (confirmAction.type === 'delete-group') {
        await axios.delete(`/api/groups/${id}`);
        navigate('/dashboard');
        return;
      }

      if (confirmAction.type === 'leave-group') {
        await axios.post(`/api/groups/${id}/leave`);
        navigate('/dashboard');
        return;
      }

      if (confirmAction.type === 'settle') {
        await axios.post(`/api/groups/${id}/settle`, {
          from_user: confirmAction.debt.from_user,
          to_user: confirmAction.debt.to_user,
          amount: confirmAction.debt.amount
        });

        pushToast(
          'Settlement recorded',
          `${confirmAction.debt.from_username} paid ${confirmAction.debt.to_username}.`,
          'success'
        );
        setConfirmAction(null);
        await refreshGroupData();
      }
    } catch (error) {
      pushToast('Action failed', error.response?.data?.error || 'Please try again.', 'error');
      setConfirmAction(null);
    }
  };

  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const youPaid = expenses
    .filter((expense) => expense.paid_by === username)
    .reduce((sum, expense) => sum + expense.amount, 0);
  const youOwe = simplifiedDebts
    .filter((debt) => debt.from_username === username)
    .reduce((sum, debt) => sum + debt.amount, 0);
  const owedToYou = simplifiedDebts
    .filter((debt) => debt.to_username === username)
    .reduce((sum, debt) => sum + debt.amount, 0);
  const totalSettled = settlements.reduce((sum, settlement) => sum + settlement.amount, 0);
  const memberSnapshots = members.map((member) => getMemberSnapshot(member, simplifiedDebts));
  const splitPreview = expenseAmount && splitMembers.length
    ? parseFloat(expenseAmount || 0) / splitMembers.length
    : 0;

  const navItems = [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Create Group', to: '/create-group' },
    { label: group?.name || 'Group Workspace', to: `/group/${id}`, active: true }
  ];

  const pageIntro = {
    eyebrow: 'Group workspace',
    title: group?.name || 'Group workspace',
    description: group?.description || 'Track members, expenses, balances, and settlements in one premium layout.',
    actions: (
      <div className="button-row">
        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            resetExpenseForm();
            setShowExpenseModal(true);
          }}
        >
          Add expense
        </button>
        <button type="button" className="button button--secondary" onClick={() => setShowMemberModal(true)}>
          Add member
        </button>
        <Link to="/dashboard" className="button button--ghost">
          Back to dashboard
        </Link>
      </div>
    )
  };

  if (loading && !group) {
    return (
      <AppShell
        username={username}
        currency={currency}
        onCurrencyChange={onCurrencyChange}
        onLogout={handleLogout}
        navItems={navItems}
        pageIntro={pageIntro}
      >
        <div className="surface loading-panel">
          <div>
            <p className="eyebrow">Loading</p>
            <h2 className="section-title">Preparing this group workspace</h2>
            <p className="section-copy">Fetching members, expenses, balances, and settlement history.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!group) {
    return (
      <AppShell
        username={username}
        currency={currency}
        onCurrencyChange={onCurrencyChange}
        onLogout={handleLogout}
        navItems={navItems}
        pageIntro={pageIntro}
      >
        <div className="surface empty-state">
          <p className="eyebrow">Unavailable</p>
          <h2 className="empty-state__title">{pageError || 'Group not found'}</h2>
          <p className="empty-state__copy">Head back to the dashboard to open another group.</p>
          <Link to="/dashboard" className="button button--primary">
            Return to dashboard
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      username={username}
      currency={currency}
      onCurrencyChange={onCurrencyChange}
      onLogout={handleLogout}
      navItems={navItems}
      pageIntro={pageIntro}
    >
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <div className="stats-grid detail-stats-grid">
        <section className="surface stat-card">
          <div className="stat-label">Total spent</div>
          <div className="stat-value">{formatCurrency(totalSpent, currency)}</div>
          <div className="stat-meta">
            <span>{expenses.length} expenses logged</span>
            <span className="trend-pill trend-pill--neutral">Group total</span>
          </div>
        </section>

        <section className="surface stat-card">
          <div className="stat-label">You paid</div>
          <div className="stat-value">{formatCurrency(youPaid, currency)}</div>
          <div className="stat-meta">
            <span>Paid directly from this account</span>
            <span className="trend-pill trend-pill--positive">You</span>
          </div>
        </section>

        <section className="surface stat-card">
          <div className="stat-label">You owe</div>
          <div className="stat-value">{formatCurrency(youOwe, currency)}</div>
          <div className="stat-meta">
            <span>Still outstanding to others</span>
            <span className="trend-pill trend-pill--negative">{simplifiedDebts.length} payment(s)</span>
          </div>
        </section>

        <section className="surface stat-card">
          <div className="stat-label">Owed to you</div>
          <div className="stat-value">{formatCurrency(owedToYou, currency)}</div>
          <div className="stat-meta">
            <span>{members.length} members in this group</span>
            <span className="trend-pill trend-pill--neutral">Workspace</span>
          </div>
        </section>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="surface table-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Expenses</p>
                <h2 className="section-title">Expense ledger</h2>
                <p className="section-copy">Every expense stays on the same backend route and validation flow.</p>
              </div>
              <div className="button-row">
                {expenses.length > 0 && (
                  <button type="button" className="button button--secondary button--small" onClick={handleExportCsv}>
                    Export CSV
                  </button>
                )}
                <button
                  type="button"
                  className="button button--primary button--small"
                  onClick={() => {
                    resetExpenseForm();
                    setShowExpenseModal(true);
                  }}
                >
                  Add expense
                </button>
              </div>
            </div>

            {expenses.length === 0 ? (
              <div className="empty-state">
                <h3 className="empty-state__title">No expenses yet.</h3>
                <p className="empty-state__copy">Add the first expense to start tracking shared balances.</p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Paid by</th>
                      <th>Split</th>
                      <th>Created</th>
                      <th>Amount</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((expense) => (
                      <tr key={expense.id}>
                        <td>
                          <strong>{expense.description || 'Untitled expense'}</strong>
                          <span className="table-secondary">
                            {expense.splits.map((split) => split.username).join(', ')}
                          </span>
                        </td>
                        <td>{expense.paid_by}</td>
                        <td>{expense.splits.length} member(s)</td>
                        <td>{formatDateTime(expense.created_at)}</td>
                        <td>{formatCurrency(expense.amount, currency)}</td>
                        <td>
                          {expense.paid_by === username && (
                            <button
                              type="button"
                              className="table-action"
                              onClick={() => handleDeleteExpense(expense.id)}
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="surface history-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Settlements</p>
                <h2 className="section-title">Settlement history</h2>
                <p className="section-copy">Confirmed payments recorded for this group.</p>
              </div>
              <div className="trend-pill trend-pill--neutral">{formatCurrency(totalSettled, currency)}</div>
            </div>

            {settlements.length === 0 ? (
              <div className="empty-state">
                <h3 className="empty-state__title">No settlements recorded yet.</h3>
                <p className="empty-state__copy">Settled payments will appear here after they are confirmed.</p>
              </div>
            ) : (
              <div className="summary-list">
                {settlements.map((settlement) => (
                  <div key={settlement.id} className="summary-row">
                    <div className="summary-row__meta">
                      <strong>{settlement.from_username} paid {settlement.to_username}</strong>
                      <span>{timeAgo(settlement.created_at)}</span>
                    </div>
                    <div className="summary-row__value">{formatCurrency(settlement.amount, currency)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="side-stack">
          <section className="surface overview-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Overview</p>
                <h2 className="section-title">Group profile</h2>
              </div>
            </div>

            <div className="info-grid">
              <div className="info-tile">
                <span className="field__hint">Owner</span>
                <strong>{group.created_by}</strong>
              </div>
              <div className="info-tile">
                <span className="field__hint">Created</span>
                <strong>{formatLongDate(group.created_at)}</strong>
              </div>
              <div className="info-tile">
                <span className="field__hint">Members</span>
                <strong>{members.length}</strong>
              </div>
              <div className="info-tile">
                <span className="field__hint">Pending</span>
                <strong>{simplifiedDebts.length} payment(s)</strong>
              </div>
            </div>

            <div className="button-row">
              {isOwner ? (
                <button
                  type="button"
                  className="button button--danger button--small"
                  onClick={() => setConfirmAction({ type: 'delete-group' })}
                >
                  Delete group
                </button>
              ) : (
                <button
                  type="button"
                  className="button button--danger button--small"
                  onClick={() => setConfirmAction({ type: 'leave-group' })}
                >
                  Leave group
                </button>
              )}
            </div>
          </section>

          <section className="surface settlement-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Settle up</p>
                <h2 className="section-title">Simplified payments</h2>
                <p className="section-copy">The backend debt simplifier stays exactly the same.</p>
              </div>
            </div>

            {simplifiedDebts.length === 0 ? (
              <div className="empty-state">
                <h3 className="empty-state__title">Everything is settled.</h3>
                <p className="empty-state__copy">No outstanding payments remain in this group.</p>
              </div>
            ) : (
              <div className="summary-list">
                {simplifiedDebts.map((debt) => (
                  <div key={`${debt.from_user}-${debt.to_user}`} className="summary-row">
                    <div className="summary-row__meta">
                      <strong>{debt.from_username} pays {debt.to_username}</strong>
                      <span>{formatCurrency(debt.amount, currency)}</span>
                    </div>
                    <button
                      type="button"
                      className="button button--primary button--small"
                      onClick={() => setConfirmAction({ type: 'settle', debt })}
                    >
                      Settle
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="surface members-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Members</p>
                <h2 className="section-title">Group members</h2>
                <p className="section-copy">Add people with the same existing search and membership routes.</p>
              </div>
              <button
                type="button"
                className="button button--secondary button--small"
                onClick={() => setShowMemberModal(true)}
              >
                Add member
              </button>
            </div>

            <div className="members-list">
              {memberSnapshots.map((member) => {
                const status = getMemberStatus(member);

                return (
                  <div key={member.id} className="member-row">
                    <div className="member-row__main">
                      <span className="avatar member-avatar">{getInitials(member.username)}</span>
                      <div className="member-meta">
                        <span className="member-name">
                          {member.username}
                          {member.username === username ? ' (you)' : ''}
                        </span>
                        <span className="field__hint">
                          {member.username === group.created_by ? 'Owner' : `Joined ${formatCompactDate(member.joined_at)}`}
                        </span>
                      </div>
                    </div>
                    <div className="member-row__aside">
                      <span className={status.className}>
                        {status.label} {formatCurrency(status.value, currency, status.value ? 2 : 0)}
                      </span>
                      {isOwner && member.username !== username && (
                        <button
                          type="button"
                          className="table-action"
                          onClick={() => handleRemoveMember(member)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="surface summary-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Balances</p>
                <h2 className="section-title">Raw balances</h2>
                <p className="section-copy">A direct view of who owes whom before simplification.</p>
              </div>
            </div>

            {balances.length === 0 ? (
              <div className="empty-state">
                <h3 className="empty-state__title">No open balances.</h3>
                <p className="empty-state__copy">Raw balances will appear here when expenses create debt.</p>
              </div>
            ) : (
              <div className="summary-list">
                {balances.map((balance, index) => (
                  <div key={`${balance.from}-${balance.to}-${index}`} className="summary-row">
                    <div className="summary-row__meta">
                      <strong>{balance.from} owes {balance.to}</strong>
                      <span>Current raw balance</span>
                    </div>
                    <div className="summary-row__value">{formatCurrency(balance.amount, currency)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      <Modal
        open={showMemberModal}
        onClose={() => {
          setShowMemberModal(false);
          setMemberName('');
          setMemberError('');
          setMemberSuggestions([]);
        }}
        title="Add member"
        description="Search by username and add the person to this group using the current backend route."
        footer={(
          <div className="button-row">
            <button type="button" className="button button--ghost" onClick={() => setShowMemberModal(false)}>
              Cancel
            </button>
            <button type="submit" form="add-member-form" className="button button--primary">
              Add member
            </button>
          </div>
        )}
      >
        <form id="add-member-form" onSubmit={handleAddMember} className="form-grid">
          {memberError && <div className="notice notice--error">{memberError}</div>}

          <div className="field inline-search">
            <label className="field__label" htmlFor="member-search">Username</label>
            <input
              id="member-search"
              type="text"
              className="input"
              value={memberName}
              onChange={(event) => handleSearchUsers(event.target.value)}
              placeholder="Start typing a username"
              required
            />

            {memberSuggestions.length > 0 && (
              <div className="suggestion-list">
                {memberSuggestions.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="suggestion-button"
                    onClick={() => {
                      setMemberName(user.username);
                      setMemberSuggestions([]);
                    }}
                  >
                    {user.username}
                  </button>
                ))}
              </div>
            )}
          </div>
        </form>
      </Modal>

      <Modal
        open={showExpenseModal}
        onClose={() => {
          resetExpenseForm();
          setShowExpenseModal(false);
        }}
        title="Add expense"
        description="Keep the existing Splitwise logic while entering a new shared expense in this premium workspace."
        size="lg"
        footer={(
          <div className="button-row">
            <button type="button" className="button button--ghost" onClick={() => setShowExpenseModal(false)}>
              Cancel
            </button>
            <button type="submit" form="add-expense-form" className="button button--primary">
              Save expense
            </button>
          </div>
        )}
      >
        <form id="add-expense-form" onSubmit={handleAddExpense} className="form-grid">
          {expenseError && <div className="notice notice--error">{expenseError}</div>}

          <div className="field">
            <label className="field__label" htmlFor="expense-description">Description</label>
            <input
              id="expense-description"
              type="text"
              className="input"
              value={expenseDescription}
              onChange={(event) => setExpenseDescription(event.target.value)}
              placeholder="Dinner, groceries, cab fare"
              required
            />
          </div>

          <div className="split-form-grid">
            <div className="field">
              <label className="field__label" htmlFor="expense-amount">Amount</label>
              <input
                id="expense-amount"
                type="number"
                min="0.01"
                step="0.01"
                className="input"
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="expense-paid-by">Paid by</label>
              <select
                id="expense-paid-by"
                className="app-select input"
                value={expensePaidBy}
                onChange={(event) => setExpensePaidBy(event.target.value)}
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.username}{member.username === username ? ' (you)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label className="field__label">Split among</label>
            <div className="split-selector">
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className={classNames(
                    'select-button',
                    splitMembers.includes(member.id) && 'select-button--active'
                  )}
                  onClick={() => toggleSplitMember(member.id)}
                >
                  {member.username}
                </button>
              ))}
            </div>
            {splitMembers.length > 0 && expenseAmount && (
              <div className="field__hint field__hint--success">
                {formatCurrency(splitPreview || 0, currency)} per selected member
              </div>
            )}
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        title={
          confirmAction?.type === 'delete-group'
            ? 'Delete this group?'
            : confirmAction?.type === 'leave-group'
              ? 'Leave this group?'
              : 'Mark payment as settled?'
        }
        description={
          confirmAction?.type === 'delete-group'
            ? 'This permanently deletes the group, its members, its expenses, and its settlement history.'
            : confirmAction?.type === 'leave-group'
              ? 'You will be removed from this group and redirected back to the dashboard.'
              : confirmAction?.debt
                ? `${confirmAction.debt.from_username} will be marked as having paid ${confirmAction.debt.to_username} ${formatCurrency(confirmAction.debt.amount, currency)}.`
                : ''
        }
        footer={(
          <div className="button-row">
            <button type="button" className="button button--ghost" onClick={() => setConfirmAction(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={classNames(
                'button',
                confirmAction?.type === 'settle' ? 'button--primary' : 'button--danger'
              )}
              onClick={handleConfirmAction}
            >
              {confirmAction?.type === 'settle' ? 'Confirm settlement' : 'Confirm'}
            </button>
          </div>
        )}
      >
        <div className="field__hint">This confirmation only changes the UI flow. The backend action remains unchanged.</div>
      </Modal>
    </AppShell>
  );
}
