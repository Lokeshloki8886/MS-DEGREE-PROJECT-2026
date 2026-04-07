import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AppShell from '../components/AppShell';
import { classNames, formatCompactDate, formatCurrency, timeAgo } from '../lib/ui';
import './Dashboard.css';

const FILTERS = [
  { key: 'all', label: 'All groups' },
  { key: 'owe', label: 'You owe' },
  { key: 'owed', label: 'Owed to you' },
  { key: 'settled', label: 'Settled' },
  { key: 'quiet', label: 'Quiet' }
];

const STATUS_LABELS = {
  owe: 'You owe',
  owed: 'Owed to you',
  settled: 'Settled',
  quiet: 'Quiet'
};

function getGroupStatus(group) {
  if (!group.expenses.length) {
    return 'quiet';
  }

  if (group.youOwe > group.owedToYou) {
    return 'owe';
  }

  if (group.owedToYou > group.youOwe) {
    return 'owed';
  }

  return 'settled';
}

function buildTrend(expenses, points = 24) {
  if (!expenses.length) {
    return Array.from({ length: points }, (_, index) => ({
      id: `trend-${index}`,
      amount: 0,
      height: 12
    }));
  }

  const latestDate = expenses.reduce((latest, expense) => {
    const createdAt = new Date(expense.created_at);
    return createdAt > latest ? createdAt : latest;
  }, new Date(0));

  const startDate = new Date(latestDate);
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (points - 1));

  const bins = Array(points).fill(0);

  expenses.forEach((expense) => {
    const date = new Date(expense.created_at);
    date.setHours(0, 0, 0, 0);

    const dayOffset = Math.floor((date - startDate) / (1000 * 60 * 60 * 24));
    if (dayOffset >= 0 && dayOffset < points) {
      bins[dayOffset] += Number(expense.amount || 0);
    }
  });

  const maxAmount = Math.max(...bins, 0);

  return bins.map((amount, index) => ({
    id: `trend-${index}`,
    amount,
    height: maxAmount > 0 ? 18 + (amount / maxAmount) * 82 : 12
  }));
}

function normalizeRatio(value, total) {
  if (total <= 0) {
    return 0;
  }

  return (value / total) * 100;
}

function buildActivityColumns(days) {
  const maxAmount = Math.max(...days.map((day) => day.amount), 0);

  return days.map((day) => {
    const filledDots = maxAmount > 0 ? Math.round((day.amount / maxAmount) * 10) : 0;

    return {
      ...day,
      filledDots: day.amount > 0 ? Math.max(1, filledDots) : 0
    };
  });
}

export default function Dashboard({ username, onLogout, currency, onCurrencyChange }) {
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [groups, setGroups] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [summaryResponse, groupsResponse] = await Promise.all([
        axios.get('/api/dashboard-summary'),
        axios.get('/api/groups')
      ]);

      const baseGroups = groupsResponse.data.groups || [];

      const enrichedGroups = await Promise.all(
        baseGroups.map(async (group) => {
          const [debtsResult, expensesResult] = await Promise.allSettled([
            axios.get(`/api/groups/${group.id}/simplified-debts`),
            axios.get(`/api/groups/${group.id}/expenses`)
          ]);

          const debts = debtsResult.status === 'fulfilled' ? debtsResult.value.data.debts || [] : [];
          const expenses = expensesResult.status === 'fulfilled' ? expensesResult.value.data.expenses || [] : [];

          let youOwe = 0;
          let owedToYou = 0;

          debts.forEach((debt) => {
            if (debt.from_username === username) {
              youOwe += debt.amount;
            }

            if (debt.to_username === username) {
              owedToYou += debt.amount;
            }
          });

          const totalSpent = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

          const data = {
            ...group,
            debts,
            expenses,
            totalSpent,
            youOwe,
            owedToYou,
            trend: buildTrend(expenses),
            latestExpense: expenses[0] || null
          };

          return {
            ...data,
            status: getGroupStatus(data)
          };
        })
      );

      setSummary(summaryResponse.data.summary || null);
      setGroups(enrichedGroups);
    } catch (requestError) {
      setSummary(null);
      setGroups([]);
      setError('Could not load dashboard data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleLogout = async () => {
    await axios.post('/api/logout');
    onLogout();
    navigate('/login');
  };

  const totalSpent = summary?.total_spent || groups.reduce((sum, group) => sum + group.totalSpent, 0);
  const totalExpenses = summary?.total_expenses || groups.reduce((sum, group) => sum + group.expenses.length, 0);

  const totalYouOwe = groups.reduce((sum, group) => sum + group.youOwe, 0);
  const totalOwedToYou = groups.reduce((sum, group) => sum + group.owedToYou, 0);
  const netPosition = totalOwedToYou - totalYouOwe;

  const allExpenses = useMemo(
    () => groups.flatMap((group) => group.expenses.map((expense) => ({ ...expense, groupId: group.id, groupName: group.name }))),
    [groups]
  );

  const now = Date.now();
  const thirtyDaysMs = 1000 * 60 * 60 * 24 * 30;

  const currentThirtyDaysSpend = allExpenses
    .filter((expense) => now - new Date(expense.created_at).getTime() <= thirtyDaysMs)
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  const previousThirtyDaysSpend = allExpenses
    .filter((expense) => {
      const age = now - new Date(expense.created_at).getTime();
      return age > thirtyDaysMs && age <= thirtyDaysMs * 2;
    })
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  const monthlyDelta = previousThirtyDaysSpend > 0
    ? ((currentThirtyDaysSpend - previousThirtyDaysSpend) / previousThirtyDaysSpend) * 100
    : 0;

  const filteredGroups = groups.filter((group) => {
    if (filter === 'all') {
      return true;
    }

    return group.status === filter;
  });

  const showcaseGroups = filteredGroups
    .slice()
    .sort((left, right) => right.totalSpent - left.totalSpent)
    .slice(0, 5);

  const recentActivity = filteredGroups
    .flatMap((group) => group.expenses.map((expense) => ({
      id: `${group.id}-${expense.id}`,
      groupId: group.id,
      groupName: group.name,
      description: expense.description || 'Untitled expense',
      paidBy: expense.paid_by,
      createdAt: expense.created_at,
      splitCount: expense.splits.length,
      amount: Number(expense.amount || 0)
    })))
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .slice(0, 10);

  const reviewGroups = filteredGroups
    .slice()
    .sort((left, right) => {
      const leftWeight = Math.abs(left.owedToYou - left.youOwe);
      const rightWeight = Math.abs(right.owedToYou - right.youOwe);
      return rightWeight - leftWeight;
    })
    .slice(0, 8);

  const largestDebtGroup = groups
    .filter((group) => group.youOwe > 0)
    .sort((left, right) => right.youOwe - left.youOwe)[0] || null;

  const activityDays = summary?.spending_by_day || [];
  const activityColumns = buildActivityColumns(activityDays);
  const weeklyTotal = activityDays.reduce((sum, day) => sum + day.amount, 0);
  const activeDays = activityDays.filter((day) => day.amount > 0).length;

  const settledApproximation = Math.max(totalSpent - totalYouOwe - totalOwedToYou, 0);
  const distributionTotal = totalYouOwe + totalOwedToYou + settledApproximation;

  const distribution = [
    {
      key: 'owe',
      label: 'You owe',
      value: totalYouOwe,
      className: 'split-distribution__segment--owe'
    },
    {
      key: 'owed',
      label: 'Owed to you',
      value: totalOwedToYou,
      className: 'split-distribution__segment--owed'
    },
    {
      key: 'settled',
      label: 'Balanced volume',
      value: settledApproximation,
      className: 'split-distribution__segment--settled'
    }
  ];

  return (
    <AppShell
      fullWidth
      compactHeader
      username={username}
      currency={currency}
      onCurrencyChange={onCurrencyChange}
      onLogout={handleLogout}
      navItems={[
        { label: 'Dashboard', to: '/dashboard', active: true },
        { label: 'Create Group', to: '/create-group' }
      ]}
    >
      <div className="split-dashboard">
        <section className="split-kpi-grid">
          <article className="surface split-kpi-card">
            <p className="split-kpi-card__label">Total spent</p>
            <h2 className="split-kpi-card__value">{formatCurrency(totalSpent, currency)}</h2>
            <div className="split-kpi-card__meta">
              <span>{totalExpenses} expenses logged</span>
              <span className="split-pill split-pill--neutral">All groups</span>
            </div>
          </article>

          <article className="surface split-kpi-card">
            <p className="split-kpi-card__label">You owe</p>
            <h2 className="split-kpi-card__value">{formatCurrency(totalYouOwe, currency)}</h2>
            <div className="split-kpi-card__meta">
              <span>Pending payments across groups</span>
              <span className="split-pill split-pill--negative">{groups.filter((group) => group.youOwe > 0).length} groups</span>
            </div>
          </article>

          <article className="surface split-kpi-card">
            <p className="split-kpi-card__label">You are owed</p>
            <h2 className="split-kpi-card__value">{formatCurrency(totalOwedToYou, currency)}</h2>
            <div className="split-kpi-card__meta">
              <span>Amounts others owe you</span>
              <span className="split-pill split-pill--positive">{groups.filter((group) => group.owedToYou > 0).length} groups</span>
            </div>
          </article>

          <article className="surface split-kpi-card">
            <p className="split-kpi-card__label">Monthly spend (30d)</p>
            <h2 className="split-kpi-card__value">{formatCurrency(currentThirtyDaysSpend, currency)}</h2>
            <div className="split-kpi-card__meta">
              <span>Compared to previous 30 days</span>
              <span className={classNames('split-pill', monthlyDelta <= 0 ? 'split-pill--positive' : 'split-pill--negative')}>
                {monthlyDelta >= 0 ? '+' : ''}{monthlyDelta.toFixed(1)}%
              </span>
            </div>
          </article>
        </section>

        {loading ? (
          <section className="surface loading-panel">
            <div>
              <p className="eyebrow">Loading</p>
              <h2 className="section-title">Syncing your dashboard</h2>
              <p className="section-copy">Fetching groups, balances, and activity data.</p>
            </div>
          </section>
        ) : groups.length === 0 ? (
          <section className="surface empty-state">
            <p className="eyebrow">No groups yet</p>
            <h2 className="empty-state__title">Create your first Splitwise group to start tracking shared expenses.</h2>
            <p className="empty-state__copy">The dashboard will populate automatically once group data exists.</p>
            <Link to="/create-group" className="button button--primary">Create group</Link>
          </section>
        ) : (
          <>
            {error && <div className="notice notice--error">{error}</div>}

            <section className="split-group-grid">
              {showcaseGroups.map((group) => (
                <article key={group.id} className="surface split-group-card">
                  <div className="split-group-card__head">
                    <div>
                      <Link to={`/group/${group.id}`} className="split-group-card__title">{group.name}</Link>
                      <p className="split-group-card__meta">{group.member_count} members / {group.expenses.length} expenses</p>
                    </div>
                    <span className={classNames('split-pill', `split-pill--${group.status}`)}>
                      {STATUS_LABELS[group.status]}
                    </span>
                  </div>

                  <p className="split-group-card__amount">{formatCurrency(group.totalSpent, currency)}</p>

                  <div className="split-spark" aria-label={`${group.name} spending trend`}>
                    {group.trend.map((point) => (
                      <span
                        key={point.id}
                        className="split-spark__bar"
                        style={{ height: `${point.height}%` }}
                        title={`${formatCurrency(point.amount, currency)}`}
                      />
                    ))}
                  </div>

                  <p className="split-group-card__summary">
                    {group.youOwe > group.owedToYou
                      ? `You owe ${formatCurrency(group.youOwe, currency)}`
                      : group.owedToYou > group.youOwe
                        ? `You are owed ${formatCurrency(group.owedToYou, currency)}`
                        : 'Balanced right now'}
                  </p>
                </article>
              ))}
            </section>

            <section className="surface split-filter-band">
              <div className="split-chip-row">
                {FILTERS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={classNames('split-chip', filter === item.key && 'split-chip--active')}
                    onClick={() => setFilter(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="split-filter-actions">
                <button type="button" className="button button--secondary button--small" onClick={loadDashboard}>
                  Refresh data
                </button>

                {largestDebtGroup ? (
                  <button
                    type="button"
                    className="button button--primary button--small"
                    onClick={() => navigate(`/group/${largestDebtGroup.id}`)}
                  >
                    Open largest debt
                  </button>
                ) : (
                  <button type="button" className="button button--secondary button--small" onClick={() => navigate('/create-group')}>
                    Create group
                  </button>
                )}
              </div>
            </section>

            <section className="split-insights-grid">
              <article className="surface split-panel">
                <div className="split-panel__head">
                  <div>
                    <p className="eyebrow">Balance distribution</p>
                    <h2 className="section-title">How your totals are split</h2>
                  </div>
                  <div className="split-net-indicator">
                    <span>Net position</span>
                    <strong className={classNames(netPosition >= 0 ? 'split-net--positive' : 'split-net--negative')}>
                      {formatCurrency(netPosition, currency)}
                    </strong>
                  </div>
                </div>

                <div className="split-distribution">
                  {distribution.map((segment) => (
                    <span
                      key={segment.key}
                      className={classNames('split-distribution__segment', segment.className)}
                      style={{ width: `${Math.max(normalizeRatio(segment.value, distributionTotal), segment.value > 0 ? 8 : 0)}%` }}
                    />
                  ))}
                </div>

                <div className="split-distribution-list">
                  {distribution.map((segment) => (
                    <div key={segment.key} className="split-distribution-list__item">
                      <div className="split-distribution-list__label">
                        <span className={classNames('split-distribution-list__dot', segment.className)} />
                        <span>{segment.label}</span>
                      </div>
                      <div>
                        <strong>{formatCurrency(segment.value, currency)}</strong>
                        <span>{normalizeRatio(segment.value, distributionTotal).toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="surface split-panel">
                <div className="split-panel__head">
                  <div>
                    <p className="eyebrow">Activity</p>
                    <h2 className="section-title">Seven-day spending heat</h2>
                  </div>
                </div>

                <div className="split-activity-grid" aria-label="Seven-day spending chart">
                  {activityColumns.map((day) => (
                    <div key={day.date} className="split-activity-column">
                      {Array.from({ length: 10 }, (_, index) => (
                        <span
                          key={`${day.date}-dot-${index}`}
                          className={classNames('split-activity-dot', index >= 10 - day.filledDots && 'split-activity-dot--active')}
                        />
                      ))}
                      <span className="split-activity-column__label">{day.label}</span>
                    </div>
                  ))}
                </div>

                <div className="split-activity-footer">
                  <div>
                    <strong>{formatCurrency(weeklyTotal, currency)}</strong>
                    <span>This week</span>
                  </div>
                  <div>
                    <strong>{activeDays}</strong>
                    <span>Active days</span>
                  </div>
                  <div>
                    <strong>{groups.length}</strong>
                    <span>Groups tracked</span>
                  </div>
                </div>
              </article>
            </section>

            <section className="split-content-grid">
              <article className="surface split-panel">
                <div className="split-panel__head">
                  <div>
                    <p className="eyebrow">Transaction</p>
                    <h2 className="section-title">Recent activity</h2>
                  </div>
                </div>

                {recentActivity.length === 0 ? (
                  <div className="empty-state">
                    <h3 className="empty-state__title">No expenses found for this filter.</h3>
                    <p className="empty-state__copy">Try a different filter or add a new expense in a group.</p>
                  </div>
                ) : (
                  <div className="split-table-wrap">
                    <table className="split-table">
                      <thead>
                        <tr>
                          <th>Group</th>
                          <th>Description</th>
                          <th>Paid by</th>
                          <th>Created</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentActivity.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <Link to={`/group/${item.groupId}`} className="split-table__link">{item.groupName}</Link>
                              <span className="table-secondary">{item.splitCount} people involved</span>
                            </td>
                            <td>{item.description}</td>
                            <td>{item.paidBy}</td>
                            <td>{timeAgo(item.createdAt)}</td>
                            <td>{formatCurrency(item.amount, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>

              <aside className="surface split-panel">
                <div className="split-panel__head">
                  <div>
                    <p className="eyebrow">Group focus</p>
                    <h2 className="section-title">Groups to review</h2>
                  </div>
                </div>

                {reviewGroups.length === 0 ? (
                  <div className="empty-state">
                    <h3 className="empty-state__title">No groups in this filter.</h3>
                    <p className="empty-state__copy">Switch the filter to review more groups.</p>
                  </div>
                ) : (
                  <div className="split-review-list">
                    {reviewGroups.map((group) => (
                      <div key={group.id} className="split-review-list__row">
                        <div>
                          <strong>{group.name}</strong>
                          <p>
                            {group.latestExpense
                              ? `Last expense ${formatCompactDate(group.latestExpense.created_at)}`
                              : 'No expenses yet'}
                          </p>
                        </div>
                        <div className="split-review-list__actions">
                          <span className={classNames('split-pill', `split-pill--${group.status}`)}>
                            {STATUS_LABELS[group.status]}
                          </span>
                          <Link to={`/group/${group.id}`} className="button button--ghost button--small">Open</Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </aside>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
