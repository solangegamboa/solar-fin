
// src/lib/authUtils.ts
'use server';

import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import type { UserProfile } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET;

interface AuthenticatedUser {
  id: string;
  // Add other essential fields if your JWT payload contains them and they are needed by API routes
  // For now, id is the primary requirement for most database operations.
}

export async function getUserIdFromAuthHeader(req: NextRequest): Promise<string | null> {
  if (!JWT_SECRET) {
    console.error('CRITICAL_AUTH_ERROR: JWT_SECRET is not set in environment. Authentication will fail.');
    return null;
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // console.warn('AUTH_WARN: Authorization header missing or not Bearer type.');
    return null;
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix
  if (!token) {
    // console.warn('AUTH_WARN: Token not found in Authorization header.');
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as (Pick<UserProfile, 'id'> & { iat: number; exp: number });
    if (decoded && decoded.id) {
      return decoded.id;
    }
    console.error('AUTH_ERROR: JWT decoded but no ID found in payload.');
    return null;
  } catch (error: any) {
    if (error instanceof jwt.TokenExpiredError) {
      console.warn('AUTH_WARN: JWT token expired. Error:', error.message);
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.warn('AUTH_WARN: JWT verification failed (e.g., malformed, invalid signature). Error:', error.message);
    } else {
      console.error('AUTH_ERROR: Unexpected error during JWT verification. Error:', error.message);
    }
    return null;
  }
}
