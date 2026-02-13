import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

const AuthContext = createContext(null);

function hasLocalData() {
  try {
    return !!localStorage.getItem('portfolioData');
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingMigration, setPendingMigration] = useState(false);

  useEffect(() => {
    api.auth.me()
      .then(data => {
        setUser(data.user);
        if (hasLocalData()) setPendingMigration(true);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.auth.login(email, password);
    setUser(data.user);
    if (hasLocalData()) setPendingMigration(true);
    return data.user;
  }, []);

  const register = useCallback(async (email, password, displayName) => {
    const data = await api.auth.register(email, password, displayName);
    setUser(data.user);
    if (hasLocalData()) setPendingMigration(true);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.auth.logout(); } catch { /* logout locally even if server call fails */ }
    setUser(null);
    setPendingMigration(false);
  }, []);

  const dismissMigration = useCallback(() => {
    setPendingMigration(false);
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    register,
    logout,
    pendingMigration,
    dismissMigration,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
