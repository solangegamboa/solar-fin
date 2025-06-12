
import { POST } from '@/app/api/auth/login/route';
import { NextResponse } from 'next/server';
import * as databaseService from '@/lib/databaseService';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

jest.mock('@/lib/databaseService');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

const mockRequest = (body) => ({
  json: jest.fn().mockResolvedValue(body),
  headers: new Headers(), // Adicionado para consistência com NextRequest
}) as any; // Uso de 'any' para simplificar o mock de NextRequest

describe('API POST /api/auth/login', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-for-login-route';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('deve retornar sucesso, dados do usuário e token no corpo em login bem-sucedido', async () => {
    const mockUserFromDb = { 
      id: 'user1', 
      email: 'test@example.com', 
      displayName: 'Test User', 
      hashedPassword: 'hashedPassword123', 
      notifyByEmail: false,
      createdAt: Date.now(), // Adicionado para conformidade com tipo UserProfile
      lastLoginAt: Date.now(), // Adicionado
    };
    const mockReturnedToken = 'signed-jwt-token';
    const userPayloadForToken = {
        id: mockUserFromDb.id,
        email: mockUserFromDb.email,
        displayName: mockUserFromDb.displayName,
        notifyByEmail: mockUserFromDb.notifyByEmail,
    };

    (databaseService.findUserByEmail as jest.Mock).mockResolvedValue(mockUserFromDb);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (databaseService.updateUserLastLogin as jest.Mock).mockResolvedValue(undefined);
    (jwt.sign as jest.Mock).mockReturnValue(mockReturnedToken);

    const req = mockRequest({ email: 'test@example.com', password: 'password' });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user).toEqual(userPayloadForToken);
    expect(body.token).toBe(mockReturnedToken);
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(databaseService.updateUserLastLogin).toHaveBeenCalledWith(mockUserFromDb.id);
  });

  it('deve retornar 401 se o usuário não for encontrado', async () => {
    (databaseService.findUserByEmail as jest.Mock).mockResolvedValue(null);
    const req = mockRequest({ email: 'nouser@example.com', password: 'password' });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.message).toBe('Invalid email or password.');
  });

  it('deve retornar 401 se a senha estiver incorreta', async () => {
    const mockUserFromDb = { id: 'user1', email: 'test@example.com', hashedPassword: 'hashedPassword123' };
    (databaseService.findUserByEmail as jest.Mock).mockResolvedValue(mockUserFromDb);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false); // Senha incorreta

    const req = mockRequest({ email: 'test@example.com', password: 'wrongpassword' });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.message).toBe('Invalid email or password.');
  });
  
  it('deve retornar 400 se email ou senha não forem fornecidos', async () => {
    const req = mockRequest({ email: 'test@example.com' }); // Sem senha
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toBe('Email and password are required.');
  });

  it('deve retornar erro 500 se JWT_SECRET não estiver configurado', async () => {
    delete process.env.JWT_SECRET;
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const req = mockRequest({ email: 'test@example.com', password: 'password' });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.message).toBe('Server configuration error.');
    expect(consoleErrorSpy).toHaveBeenCalledWith('JWT_SECRET is not set');
    
    consoleErrorSpy.mockRestore();
  });
});
