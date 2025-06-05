
'use client';

import type { UserProfile, AuthApiResponse } from '@/types';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation'; // For redirects
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthApiResponse>;
  signup: (email: string, password: string, displayName?: string) => Promise<AuthApiResponse>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false, message: 'Not implemented' }),
  signup: async () => ({ success: false, message: 'Not implemented' }),
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const fetchCurrentUser = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/me');
      const data: AuthApiResponse = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (email: string, password: string): Promise<AuthApiResponse> => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data: AuthApiResponse = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        toast({ title: 'Login bem-sucedido!', description: `Bem-vindo de volta, ${data.user.displayName || data.user.email}!` });
      } else {
         toast({ variant: 'destructive', title: 'Falha no Login', description: data.message || 'Credenciais inválidas.' });
      }
      return data;
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro de Login', description: error.message || 'Ocorreu um erro.'});
      return { success: false, message: error.message || 'An unexpected error occurred.' };
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password: string, displayName?: string): Promise<AuthApiResponse> => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });
      const data: AuthApiResponse = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        toast({ title: 'Cadastro realizado!', description: `Bem-vindo, ${data.user.displayName || data.user.email}!`});
      } else {
        toast({ variant: 'destructive', title: 'Falha no Cadastro', description: data.message || 'Não foi possível criar a conta.' });
      }
      return data;
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro de Cadastro', description: error.message || 'Ocorreu um erro.'});
      return { success: false, message: error.message || 'An unexpected error occurred during signup.' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      toast({ title: 'Logout realizado', description: 'Até logo!' });
      router.push('/login'); // Redirect to login after logout
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro no Logout', description: error.message || 'Ocorreu um erro.'});
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
