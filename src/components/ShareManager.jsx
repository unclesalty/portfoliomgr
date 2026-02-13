import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, UserPlus } from 'lucide-react';

export default function ShareManager() {
  const { currentPortfolio } = usePortfolio();
  const [shares, setShares] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const portfolioId = currentPortfolio?.id;

  useEffect(() => {
    if (!portfolioId) return;
    api.shares.list(portfolioId)
      .then(data => setShares(data.shares))
      .catch(err => console.error('Failed to load shares:', err));
  }, [portfolioId]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setLoading(true);
    try {
      const data = await api.shares.invite(portfolioId, email.trim(), role);
      setShares(prev => [...prev, {
        user_id: data.share.userId,
        email: data.share.email,
        display_name: data.share.displayName,
        role: data.share.role,
      }]);
      setEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await api.shares.updateRole(portfolioId, userId, newRole);
      setShares(prev => prev.map(s =>
        s.user_id === userId ? { ...s, role: newRole } : s
      ));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRevoke = async (userId) => {
    if (!confirm('Revoke access for this user?')) return;
    try {
      await api.shares.revoke(portfolioId, userId);
      setShares(prev => prev.filter(s => s.user_id !== userId));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleInvite} className="space-y-3">
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>
        )}
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="shareEmail" className="sr-only">Email</Label>
            <Input
              id="shareEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={loading}>
            <UserPlus className="h-4 w-4 mr-1" />
            {loading ? 'Inviting...' : 'Invite'}
          </Button>
        </div>
      </form>

      {shares.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          No one else has access to this portfolio yet.
        </p>
      ) : (
        <div className="space-y-2">
          {shares.map(share => (
            <div key={share.user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-sm">{share.display_name || share.email}</p>
                {share.display_name && (
                  <p className="text-xs text-gray-500">{share.email}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={share.role}
                  onValueChange={(newRole) => handleUpdateRole(share.user_id, newRole)}
                >
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevoke(share.user_id)}
                  className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
