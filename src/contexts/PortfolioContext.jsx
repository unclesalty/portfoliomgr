import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const PortfolioContext = createContext(null);

export function PortfolioProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [portfolios, setPortfolios] = useState([]);
  const [currentPortfolio, setCurrentPortfolio] = useState(null);
  const [accessRole, setAccessRole] = useState('owner');
  const [loading, setLoading] = useState(false);

  const fetchPortfolios = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await api.portfolios.list();
      setPortfolios(data.portfolios);
    } catch (err) {
      console.error('Failed to fetch portfolios:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPortfolios();
    } else {
      setPortfolios([]);
      setCurrentPortfolio(null);
    }
  }, [isAuthenticated, fetchPortfolios]);

  const switchPortfolio = useCallback(async (id) => {
    try {
      const data = await api.portfolios.get(id);
      setCurrentPortfolio(data.portfolio);
      setAccessRole(data.portfolio.role);
    } catch (err) {
      console.error('Failed to load portfolio:', err);
    }
  }, []);

  const createPortfolio = useCallback(async (name, clientName) => {
    const data = await api.portfolios.create({ name, clientName });
    await fetchPortfolios();
    return data.portfolio;
  }, [fetchPortfolios]);

  const deletePortfolio = useCallback(async (id) => {
    await api.portfolios.delete(id);
    if (currentPortfolio?.id === id) {
      setCurrentPortfolio(null);
    }
    await fetchPortfolios();
  }, [currentPortfolio, fetchPortfolios]);

  const savePortfolioData = useCallback(async (portfolioData) => {
    if (!currentPortfolio) return;
    try {
      await api.portfolios.update(currentPortfolio.id, { data: portfolioData });
      setCurrentPortfolio(prev => ({ ...prev, data: { ...prev.data, ...portfolioData } }));
    } catch (err) {
      console.error('Failed to save portfolio:', err);
    }
  }, [currentPortfolio]);

  const updatePortfolioName = useCallback(async (name, clientName) => {
    if (!currentPortfolio) return;
    await api.portfolios.update(currentPortfolio.id, { name, clientName });
    setCurrentPortfolio(prev => ({ ...prev, name, clientName }));
    await fetchPortfolios();
  }, [currentPortfolio, fetchPortfolios]);

  const exitPortfolio = useCallback(() => {
    setCurrentPortfolio(null);
    setAccessRole('owner');
  }, []);

  const value = {
    portfolios,
    currentPortfolio,
    accessRole,
    loading,
    switchPortfolio,
    createPortfolio,
    deletePortfolio,
    savePortfolioData,
    updatePortfolioName,
    fetchPortfolios,
    exitPortfolio,
    isViewer: accessRole === 'viewer',
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}
