
'use client';

import type { UserProfile, AuthApiResponse } from '@/types';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation'; 
import { useToast } from '@/hooks/use-toast';
import jwt, {type JwtPayload } from 'jsonwebtoken'; // For decoding token client-side

const AUTH_TOKEN_KEY = 'authToken';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthApiResponse>;
  signup: (email: string, password: string, displayName?: string) => Promise<AuthApiResponse>;
  logout: () => Promise<void>;
  updateUserContext: (updatedUserFields: Partial<UserProfile>) => void;
  getToken: () => string | null; // Added to provide token for API calls
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false, message: 'Not implemented' }),
  signup: async () => ({ success: false, message: 'Not implemented' }),
  logout: async () => {},
  updateUserContext: () => {},
  getToken: () => null,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const getToken = useCallback(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    }
    return null;
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    setLoading(true);
    const token = getToken();

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data: AuthApiResponse = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
        localStorage.removeItem(AUTH_TOKEN_KEY); // Token might be invalid/expired
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      setUser(null);
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  // Attempt to load user from token on initial mount for faster UI update
  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        // Note: JWT_SECRET is not available on client. This decoding is only for non-sensitive display data.
        // Sensitive actions and final auth status MUST rely on server-side /api/auth/me verification.
        const decoded = jwt.decode(token) as (JwtPayload & UserProfile);
        if (decoded && decoded.exp && decoded.exp * 1000 > Date.now()) {
          setUser({ // Set a temporary user object based on decoded token
            id: decoded.id,
            email: decoded.email,
            displayName: decoded.displayName,
            notifyByEmail: decoded.notifyByEmail,
            // createdAt and lastLoginAt would come from /api/auth/me
          });
        } else {
           localStorage.removeItem(AUTH_TOKEN_KEY); // Expired token
        }
      } catch (e) {
        console.warn("Error decoding token on client init:", e);
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
    }
    fetchCurrentUser(); // Always verify with the server
  }, [fetchCurrentUser, getToken]);


  const login = async (email: string, password: string): Promise<AuthApiResponse> => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data: AuthApiResponse & { token?: string } = await res.json();
      if (data.success && data.user && data.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        setUser(data.user);
        toast({ title: 'Login bem-sucedido!', description: `Bem-vindo de volta, ${data.user.displayName || data.user.email}!`, duration: 800 });
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
      const data: AuthApiResponse & { token?: string } = await res.json();
      if (data.success && data.user && data.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        setUser(data.user);
        toast({ title: 'Cadastro realizado!', description: `Bem-vindo, ${data.user.displayName || data.user.email}!`, duration: 800 });
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
    setLoading(true); // Optional: indicate loading during logout
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setUser(null);
    try {
      // Optional: Call server to invalidate session if server keeps active session list
      await fetch('/api/auth/logout', { method: 'POST' });
      toast({ title: 'Logout realizado', description: 'Até logo!' });
    } catch (error: any) {
      // Even if API call fails, client-side logout is done.
      console.error("Error calling logout API:", error.message);
      // toast({ variant: 'destructive', title: 'Erro no Logout', description: error.message || 'Ocorreu um erro ao contatar o servidor.'});
    } finally {
      setLoading(false);
      router.push('/login'); 
    }
  };

  const updateUserContext = (updatedUserFields: Partial<UserProfile>) => {
    setUser(prevUser => prevUser ? { ...prevUser, ...updatedUserFields } : null);
    // If token payload needs update, a new token might need to be issued by server.
    // For now, this only updates client-side context.
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateUserContext, getToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
