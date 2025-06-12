
import { AuthContext, AuthProvider } from '@/contexts/AuthContext';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useToast } from '@/hooks/use-toast';
import React from 'react'; // Import React for JSX

// Mock global para fetch
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn();
}

// Mock para useToast
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock localStorage (já deve estar no jest.setup.js, mas pode ser redefinido aqui para clareza ou controle específico do teste)
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; }, // Adicionado para conformidade com a interface Storage
    key: (index: number) => Object.keys(store)[index] || null, // Adicionado para conformidade
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });


// Mock Next.js Router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    // Adicione outros métodos do router que você usa, se necessário
  }),
}));


describe('AuthContext - login', () => {
  let mockToastFn: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    mockToastFn = jest.fn();
    (useToast as jest.Mock).mockReturnValue({ toast: mockToastFn });
    (global.fetch as jest.Mock).mockClear(); // Limpar mocks de fetch
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;

  it('deve fazer login com sucesso, armazenar o token no localStorage e atualizar o usuário', async () => {
    const mockUserData = { id: 'user1', email: 'test@example.com', displayName: 'Test User', notifyByEmail: false };
    const mockToken = 'mock-jwt-token';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, user: mockUserData, token: mockToken }),
    });

    const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });
    
    await waitFor(() => {
        expect(result.current.user?.email).toEqual(mockUserData.email);
        expect(result.current.user?.id).toEqual(mockUserData.id);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
    }));
    expect(localStorageMock.getItem('authToken')).toBe(mockToken);
    expect(mockToastFn).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Login bem-sucedido!',
    }));
  });

  it('deve mostrar erro se o login da API falhar', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false, // Simula falha na resposta da API
      status: 401, // Status comum para credenciais inválidas
      json: async () => ({ success: false, message: 'Credenciais inválidas.' }),
    });

    const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'wrongpassword');
    });
    
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(localStorageMock.getItem('authToken')).toBeNull();
    expect(result.current.user).toBeNull();
    expect(mockToastFn).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'destructive',
      title: 'Falha no Login',
      description: 'Credenciais inválidas.',
    }));
  });

  it('deve lidar com erro de rede durante o login', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

    const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(localStorageMock.getItem('authToken')).toBeNull();
    expect(result.current.user).toBeNull();
    expect(mockToastFn).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'destructive',
      title: 'Erro de Login',
      description: 'Network Error', // Ou a mensagem de erro padrão
    }));
  });
});
