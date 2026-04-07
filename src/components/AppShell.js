import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { classNames, currencyOptions, getInitials } from '../lib/ui';

function Brand() {
  return (
    <Link to="/dashboard" className="brand">
      <span className="brand-mark" aria-hidden="true">
        <span className="brand-ring" />
        <span className="brand-ring brand-ring--offset" />
      </span>
      <span className="brand-copy">
        <span className="brand-overline">Shared expense dashboard</span>
        <span className="brand-name">Splitwise</span>
      </span>
    </Link>
  );
}

export default function AppShell({
  username,
  currency,
  onCurrencyChange,
  onLogout,
  navItems,
  pageIntro,
  fullWidth = false,
  compactHeader = false,
  children
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app-root">
      <div className={classNames('page-shell', fullWidth && 'page-shell--wide')}>
        <header className={classNames('app-header', 'surface', 'surface--glass', compactHeader && 'app-header--compact')}>
          <Brand />

          <nav className="header-nav" aria-label="Primary">
            {navItems.map((item) => {
              const pillClassName = classNames(
                'nav-pill',
                item.active && 'nav-pill--active',
                item.disabled && 'nav-pill--disabled'
              );

              if (item.disabled) {
                return (
                  <span key={item.label} className={pillClassName} aria-disabled="true">
                    {item.label}
                  </span>
                );
              }

              return (
                <Link key={item.label} to={item.to} className={pillClassName}>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="header-actions">
            <label className="header-control" aria-label="Currency">
              <select
                value={currency}
                onChange={(event) => onCurrencyChange(event.target.value)}
                className="app-select"
                aria-label="Currency"
              >
                {currencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              <span className="theme-toggle__label">Theme</span>
              <span className="theme-toggle__value">{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>

            <div className="user-chip">
              <span className="avatar">{getInitials(username)}</span>
              <span className="user-chip__name">{username}</span>
            </div>

            <button type="button" className="button button--ghost button--small" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        {pageIntro && (
          <section className="page-intro surface">
            <div className="intro-copy">
              {pageIntro.eyebrow && <p className="eyebrow">{pageIntro.eyebrow}</p>}
              <h1 className="page-title">{pageIntro.title}</h1>
              {pageIntro.description && <p className="page-copy">{pageIntro.description}</p>}
            </div>
            {pageIntro.actions && <div className="intro-actions">{pageIntro.actions}</div>}
          </section>
        )}

        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
