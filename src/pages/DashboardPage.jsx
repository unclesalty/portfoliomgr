import { useState } from 'react';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, FolderOpen, LogOut, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import RoleBadge from '@/components/RoleBadge';
import fayeLogo from '@/assets/faye-logo-white.png';

export default function DashboardPage() {
  const { portfolios, loading, createPortfolio, deletePortfolio, switchPortfolio, fetchPortfolios } = usePortfolio();
  const { user, logout, pendingMigration, dismissMigration } = useAuth();
  const [newName, setNewName] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const owned = portfolios.filter(p => p.role === 'owner');
  const shared = portfolios.filter(p => p.role !== 'owner');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const portfolio = await createPortfolio(newName.trim(), newClientName.trim() || undefined);
      setNewName('');
      setNewClientName('');
      setCreateOpen(false);
      await switchPortfolio(portfolio.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deletePortfolio(id);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const localData = JSON.parse(localStorage.getItem('portfolioData'));
      const rocks = JSON.parse(localStorage.getItem('rocks') || '[]');
      const contractHours = parseInt(localStorage.getItem('contractHours') || '0', 10);

      const portfolio = await createPortfolio(
        localData.clientName || 'Migrated Portfolio',
        localData.clientName || undefined
      );

      await api.portfolios.update(portfolio.id, {
        data: {
          projects: localData.projects || [],
          valueStreams: localData.valueStreams || [],
          resourceTypes: localData.resourceTypes || [],
          rocks,
          contractHours,
        },
      });

      ['portfolioData', 'rocks', 'contractHours', 'fayePortfolioLastScenarioName'].forEach(
        key => localStorage.removeItem(key)
      );
      Object.keys(localStorage)
        .filter(key => key.startsWith('fayePortfolioScenario_'))
        .forEach(key => localStorage.removeItem(key));

      dismissMigration();
      await fetchPortfolios();
      await switchPortfolio(portfolio.id);
    } catch (err) {
      alert('Migration failed: ' + err.message);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-[#59168B] text-white p-4">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img src={fayeLogo} alt="Faye Logo" className="h-8" />
            <h1 className="text-xl font-bold">Portfolio Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-purple-200">
              {user?.displayName || user?.email}
            </span>
            <Button variant="ghost" onClick={logout} className="text-white hover:text-purple-200">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {pendingMigration && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Upload className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">Local data detected</p>
                  <p className="text-sm text-blue-700">
                    You have portfolio data stored locally. Would you like to migrate it to the server?
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={dismissMigration}>
                  Skip
                </Button>
                <Button size="sm" onClick={handleMigrate} disabled={migrating}>
                  {migrating ? 'Migrating...' : 'Migrate Now'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Your Portfolios</h2>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Portfolio
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Portfolio</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="portfolioName">Portfolio Name</Label>
                  <Input
                    id="portfolioName"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., Q1 2026 Roadmap"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name (optional)</Label>
                  <Input
                    id="clientName"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="e.g., Acme Corp"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Portfolio'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading portfolios...</p>
        ) : (
          <>
            {owned.length === 0 && shared.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  <FolderOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg mb-2">No portfolios yet</p>
                  <p className="text-sm">Create your first portfolio to get started.</p>
                </CardContent>
              </Card>
            )}

            {owned.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-500 uppercase">Owned by you</h3>
                {owned.map(p => (
                  <Card key={p.id} className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => switchPortfolio(p.id)}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{p.name}</h4>
                        {p.clientName && <p className="text-sm text-gray-500">{p.clientName}</p>}
                        <p className="text-xs text-gray-400">Updated {new Date(p.updatedAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RoleBadge role="owner" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.name); }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {shared.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-500 uppercase">Shared with you</h3>
                {shared.map(p => (
                  <Card key={p.id} className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => switchPortfolio(p.id)}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{p.name}</h4>
                        {p.clientName && <p className="text-sm text-gray-500">{p.clientName}</p>}
                        <p className="text-xs text-gray-400">Updated {new Date(p.updatedAt).toLocaleDateString()}</p>
                      </div>
                      <RoleBadge role={p.role} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
