export const currencyOptions = [
  { value: '$', label: 'USD $' },
  { value: 'Rs', label: 'INR Rs' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'JPY', label: 'JPY' },
  { value: 'KRW', label: 'KRW' },
  { value: 'A$', label: 'AUD A$' },
  { value: 'C$', label: 'CAD C$' }
];

export function normalizeCurrency(value) {
  return currencyOptions.some((option) => option.value === value) ? value : '$';
}

export function formatCurrency(amount, currency = '$', digits = 2) {
  const safeAmount = Number(amount || 0);
  const formatted = safeAmount.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });

  return /^[A-Z]/.test(currency) ? `${currency} ${formatted}` : `${currency}${formatted}`;
}

export function formatCompactDate(value) {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

export function formatLongDate(value) {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatDateTime(value) {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function timeAgo(value) {
  if (!value) {
    return '--';
  }

  const now = new Date();
  const then = new Date(value);
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  return then.toLocaleDateString();
}

export function getInitials(name = '?') {
  const cleaned = name.trim();
  if (!cleaned) {
    return '?';
  }

  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

export function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function buildMiniBars(seed, count = 28) {
  return Array.from({ length: count }, (_, index) => {
    const raw = (seed * 19 + index * 13 + 17) % 100;
    return 18 + raw * 0.72;
  });
}
