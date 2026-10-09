const BASE = import.meta.env.VITE_API_URL || '/api';

async function get(path, params = {}) {
  const res = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Request failed');
  return res.json();
}

export const getCurrencies = () => get('/currencies');
export const convert = (from, to, amount) => get('/convert', { from, to, amount });
export const getHistory = (from, to, days) => get('/history', { from, to, days });
