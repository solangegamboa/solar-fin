
import { POST } from '@/app/api/transactions/route';
import { NextResponse } from 'next/server';
import * as databaseService from '@/lib/databaseService';
import * as authUtils from '@/lib/authUtils'; // Importar o módulo mockado

jest.mock('@/lib/databaseService');
jest.mock('@/lib/authUtils');

const mockRequest = (body, authorizationHeader) => {
  const headers = new Headers();
  if (authorizationHeader) {
    headers.set('Authorization', authorizationHeader);
  }
  return {
    json: jest.fn().mockResolvedValue(body),
    headers: headers,
  } as any;
};

describe('API POST /api/transactions', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-for-transactions'; // Necessário para authUtils
  });

   afterAll(() => {
    process.env = OLD_ENV;
  });

  it('deve criar uma transação com sucesso se autenticado com Bearer token e dados válidos', async () => {
    const mockUserId = 'user-id-from-token';
    const mockValidToken = 'valid-jwt-token'; // O valor real do token não importa tanto quanto o mock de authUtils
    const transactionData = { type: 'income', amount: 200, category: 'Freelance', date: '2023-02-01', recurrenceFrequency: 'none' };
    
    (authUtils.getUserIdFromAuthHeader as jest.Mock).mockResolvedValue(mockUserId);
    (databaseService.addTransaction as jest.Mock).mockResolvedValue({ success: true, transactionId: 'new-tx-id-bearer' });

    const req = mockRequest(transactionData, `Bearer ${mockValidToken}`);
    const response = await POST(req);
    const body = await response.json();

    expect(authUtils.getUserIdFromAuthHeader).toHaveBeenCalledWith(req);
    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.transactionId).toBe('new-tx-id-bearer');
    expect(databaseService.addTransaction).toHaveBeenCalledWith(mockUserId, expect.objectContaining(transactionData));
  });

  it('deve retornar 401 se não autenticado (getUserIdFromAuthHeader retorna null)', async () => {
    const transactionData = { type: 'income', amount: 100, category: 'Salário', date: '2023-01-01' };
    
    (authUtils.getUserIdFromAuthHeader as jest.Mock).mockResolvedValue(null);

    const req = mockRequest(transactionData, 'Bearer invalid-or-expired-token');
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.message).toBe('Not authenticated.');
    expect(databaseService.addTransaction).not.toHaveBeenCalled();
  });

  it('deve retornar 400 para dados de transação inválidos (ex: amount <= 0)', async () => {
    const mockUserId = 'user123';
    const mockToken = 'valid-token';
    (authUtils.getUserIdFromAuthHeader as jest.Mock).mockResolvedValue(mockUserId);
    
    const transactionData = { type: 'expense', amount: 0, category: 'Comida', date: '2023-01-01' };
    const req = mockRequest(transactionData, `Bearer ${mockToken}`);
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toBe('Amount must be positive.');
  });

  it('deve retornar 400 se campos obrigatórios estiverem faltando', async () => {
    const mockUserId = 'user123';
    const mockToken = 'valid-token';
    (authUtils.getUserIdFromAuthHeader as jest.Mock).mockResolvedValue(mockUserId);

    const transactionData = { type: 'income', amount: 100 }; // Faltando category e date
    const req = mockRequest(transactionData, `Bearer ${mockToken}`);
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toBe('Missing required transaction fields.');
  });

  it('deve retornar 500 se houver um erro no databaseService', async () => {
    const mockUserId = 'user123';
    const mockToken = 'valid-token';
    (authUtils.getUserIdFromAuthHeader as jest.Mock).mockResolvedValue(mockUserId);
    (databaseService.addTransaction as jest.Mock).mockResolvedValue({ success: false, error: 'DB error' });

    const transactionData = { type: 'income', amount: 100, category: 'Salário', date: '2023-01-01', recurrenceFrequency: 'none' };
    const req = mockRequest(transactionData, `Bearer ${mockToken}`);
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.message).toBe('DB error');
  });
  
  it('deve retornar 500 para erro de JSON inválido no payload', async () => {
    const mockUserId = 'user123';
    const mockToken = 'valid-token';
    (authUtils.getUserIdFromAuthHeader as jest.Mock).mockResolvedValue(mockUserId);
    
    const req = { // Simulando um erro de JSON.parse
      headers: new Headers({ 'Authorization': `Bearer ${mockToken}` }),
      json: jest.fn().mockRejectedValueOnce(new SyntaxError("Unexpected token i in JSON at position 1")),
    } as any;
    
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400); // Ou 500 dependendo de como o Next.js trata isso internamente antes de chegar ao seu handler
    expect(body.success).toBe(false);
    expect(body.message).toBe('Invalid JSON payload.');
  });
});
