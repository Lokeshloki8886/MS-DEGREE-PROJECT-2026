import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const defaultHighlights = [
  'Track shared expenses across every group.',
  'Keep balances readable and settle with fewer steps.',
  'Switch between dark and light mode anytime.'
];

const defaultMetrics = ['Groups', 'Balances', 'Settlements'];

export default function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  highlights = defaultHighlights,
  metrics = defaultMetrics
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app-root auth-root">
      <div className="page-shell auth-shell">
        <header className="auth-header">
          <Link to="/login" className="brand">
            <span className="brand-mark" aria-hidden="true">
              <span className="brand-ring" />
              <span className="brand-ring brand-ring--offset" />
            </span>
            <span className="brand-copy">
              <span className="brand-overline">Shared expense dashboard</span>
              <span className="brand-name">Splitwise</span>
            </span>
          </Link>

          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            <span className="theme-toggle__label">Theme</span>
            <span className="theme-toggle__value">{theme === 'dark' ? 'Dark' : 'Light'}</span>
          </button>
        </header>

        <div className="auth-grid">
          <section className="surface auth-hero">
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <h1 className="auth-title">{title}</h1>
              <p className="auth-copy">{subtitle}</p>

              <div className="auth-metrics">
                {metrics.map((metric) => (
                  <span key={metric} className="metric-chip">
                    {metric}
                  </span>
                ))}
              </div>
            </div>

            <ul className="metric-list">
              {highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
          </section>

          <section className="surface auth-card">
            {children}
            {footer && <div className="auth-footer">{footer}</div>}
          </section>
        </div>
      </div>
    </div>
  );
}
