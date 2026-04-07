import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import App from './App';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { ThemeProvider } from './context/ThemeContext';

jest.mock('axios');

function mockGetRoutes(routes) {
  axios.get.mockImplementation((url) => {
    if (Object.prototype.hasOwnProperty.call(routes, url)) {
      const value = routes[url];

      if (value?.reject) {
        return Promise.reject(value.reject);
      }

      return Promise.resolve(value);
    }

    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  window.history.pushState({}, '', '/');
  axios.post.mockResolvedValue({ data: {} });
  axios.delete.mockResolvedValue({ data: {} });
});

test('persists the theme toggle selection', async () => {
  const view = render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <Login onLogin={jest.fn()} />
      </ThemeProvider>
    </MemoryRouter>
  );

  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

  await userEvent.click(screen.getByRole('button', { name: /toggle theme/i }));

  await waitFor(() => {
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem('splitwise-theme')).toBe('light');
  });

  view.unmount();

  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <Login onLogin={jest.fn()} />
      </ThemeProvider>
    </MemoryRouter>
  );

  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
});

test('redirects unauthenticated users from the dashboard to login', async () => {
  mockGetRoutes({
    '/api/me': {
      reject: {
        response: {
          status: 401,
          data: { error: 'Not logged in' }
        }
      }
    }
  });

  window.history.pushState({}, '', '/dashboard');
  render(<App />);

  await screen.findByRole('button', { name: /sign in/i });
  await waitFor(() => expect(window.location.pathname).toBe('/login'));
});

test('renders the splitwise dashboard shell with mocked data', async () => {
  mockGetRoutes({
    '/api/dashboard-summary': {
      data: {
        summary: {
          total_spent: 540.75,
          total_groups: 2,
          total_expenses: 4,
          spending_by_day: [
            { date: '2026-03-28', label: 'Sat', amount: 0 },
            { date: '2026-03-29', label: 'Sun', amount: 42.5 },
            { date: '2026-03-30', label: 'Mon', amount: 75 },
            { date: '2026-03-31', label: 'Tue', amount: 0 },
            { date: '2026-04-01', label: 'Wed', amount: 120 },
            { date: '2026-04-02', label: 'Thu', amount: 88.25 },
            { date: '2026-04-03', label: 'Fri', amount: 215 }
          ]
        }
      }
    },
    '/api/groups': {
      data: {
        groups: [
          {
            id: 1,
            name: 'Trip Crew',
            description: 'Weekend travel',
            created_at: '2026-04-01T10:00:00',
            member_count: 4
          },
          {
            id: 2,
            name: 'Flatmates',
            description: 'Rent and groceries',
            created_at: '2026-04-02T11:00:00',
            member_count: 3
          }
        ]
      }
    },
    '/api/groups/1/expenses': {
      data: {
        expenses: [
          {
            id: 11,
            description: 'Hotel',
            amount: 250,
            created_at: '2026-04-03T08:00:00',
            paid_by: 'alex',
            splits: [{ user_id: 1, username: 'alex', amount: 62.5 }]
          }
        ]
      }
    },
    '/api/groups/2/expenses': {
      data: {
        expenses: [
          {
            id: 22,
            description: 'Groceries',
            amount: 150.75,
            created_at: '2026-04-02T09:30:00',
            paid_by: 'leo',
            splits: [
              { user_id: 1, username: 'alex', amount: 50.25 },
              { user_id: 4, username: 'leo', amount: 50.25 }
            ]
          }
        ]
      }
    },
    '/api/groups/1/simplified-debts': {
      data: {
        debts: [
          {
            from_user: 2,
            from_username: 'alex',
            to_user: 3,
            to_username: 'maya',
            amount: 32.5
          }
        ]
      }
    },
    '/api/groups/2/simplified-debts': {
      data: {
        debts: [
          {
            from_user: 4,
            from_username: 'leo',
            to_user: 2,
            to_username: 'alex',
            amount: 47.25
          }
        ]
      }
    }
  });

  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <Dashboard
          username="alex"
          onLogout={jest.fn()}
          currency="$"
          onCurrencyChange={jest.fn()}
        />
      </ThemeProvider>
    </MemoryRouter>
  );

  await screen.findByText(/total spent/i);
  await waitFor(() => {
    expect(screen.queryByText(/syncing your dashboard/i)).not.toBeInTheDocument();
  });

  expect(screen.getByText(/monthly spend/i)).toBeInTheDocument();
  expect(screen.getByText(/seven-day spending heat/i)).toBeInTheDocument();
  expect(screen.getByText(/balance distribution/i)).toBeInTheDocument();
  expect(screen.getAllByText(/transaction/i).length).toBeGreaterThan(0);
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
});

test('renders group detail modals in the premium workspace', async () => {
  mockGetRoutes({
    '/api/me': { data: { username: 'alex' } },
    '/api/groups/7': {
      data: {
        group: {
          id: 7,
          name: 'Goa Trip',
          description: 'Beach weekend',
          created_at: '2026-04-01T10:00:00',
          created_by: 'alex'
        },
        members: [
          { id: 1, username: 'alex', joined_at: '2026-04-01T10:00:00' },
          { id: 2, username: 'maya', joined_at: '2026-04-01T10:10:00' }
        ]
      }
    },
    '/api/groups/7/expenses': {
      data: {
        expenses: [
          {
            id: 91,
            description: 'Villa',
            amount: 400,
            created_at: '2026-04-02T12:00:00',
            paid_by: 'alex',
            splits: [
              { user_id: 1, username: 'alex', amount: 200 },
              { user_id: 2, username: 'maya', amount: 200 }
            ]
          }
        ]
      }
    },
    '/api/groups/7/balances': {
      data: {
        balances: [{ from: 'maya', to: 'alex', amount: 200 }]
      }
    },
    '/api/groups/7/simplified-debts': {
      data: {
        debts: [
          {
            from_user: 2,
            from_username: 'maya',
            to_user: 1,
            to_username: 'alex',
            amount: 200
          }
        ]
      }
    },
    '/api/groups/7/settlements': {
      data: {
        settlements: []
      }
    }
  });

  window.history.pushState({}, '', '/group/7');
  render(<App />);

  await screen.findByText(/expense ledger/i);

  await userEvent.click(screen.getAllByRole('button', { name: /add expense/i })[0]);
  const expenseDialog = await screen.findByRole('dialog');
  expect(within(expenseDialog).getByText(/keep the existing splitwise logic/i)).toBeInTheDocument();
  await userEvent.click(within(expenseDialog).getByRole('button', { name: /close modal/i }));

  await userEvent.click(screen.getAllByRole('button', { name: /add member/i })[0]);
  const memberDialog = await screen.findByRole('dialog');
  expect(within(memberDialog).getByText(/search by username/i)).toBeInTheDocument();
});
