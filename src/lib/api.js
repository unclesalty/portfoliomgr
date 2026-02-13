const API_BASE = '/api';

let isRefreshing = false;
let refreshPromise = null;

async function rawRequest(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

async function request(url, options = {}) {
  try {
    return await rawRequest(url, options);
  } catch (err) {
    // Auto-refresh on 401 (skip for auth endpoints to avoid loops)
    if (err.status === 401 && !url.startsWith('/auth/')) {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = rawRequest('/auth/refresh', { method: 'POST' })
          .finally(() => { isRefreshing = false; });
      }
      try {
        await refreshPromise;
        return await rawRequest(url, options);
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

export const api = {
  auth: {
    login: (email, password) =>
      rawRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: (email, password, displayName) =>
      rawRequest('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, displayName }) }),
    logout: () =>
      rawRequest('/auth/logout', { method: 'POST' }),
    me: () =>
      rawRequest('/auth/me'),
    refresh: () =>
      rawRequest('/auth/refresh', { method: 'POST' }),
    changePassword: (currentPassword, newPassword) =>
      rawRequest('/auth/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),
  },
  portfolios: {
    list: () =>
      request('/portfolios'),
    get: (id) =>
      request(`/portfolios/${id}`),
    create: (data) =>
      request('/portfolios', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) =>
      request(`/portfolios/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) =>
      request(`/portfolios/${id}`, { method: 'DELETE' }),
  },
  shares: {
    list: (portfolioId) =>
      request(`/portfolios/${portfolioId}/shares`),
    invite: (portfolioId, email, role) =>
      request(`/portfolios/${portfolioId}/shares`, { method: 'POST', body: JSON.stringify({ email, role }) }),
    updateRole: (portfolioId, userId, role) =>
      request(`/portfolios/${portfolioId}/shares/${userId}`, { method: 'PUT', body: JSON.stringify({ role }) }),
    revoke: (portfolioId, userId) =>
      request(`/portfolios/${portfolioId}/shares/${userId}`, { method: 'DELETE' }),
  },
};
