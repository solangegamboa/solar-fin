
import { NextResponse, type NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { findUserById } from '@/lib/databaseService';
import type { UserProfile } from '@/types';


const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'authToken';

export async function GET(req: NextRequest) {
  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not set');
    return NextResponse.json({ success: false, message: 'Server configuration error.' }, { status: 500 });
  }

  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as (Pick<UserProfile, 'id'> & {iat: number, exp: number});
    
    if (!decoded || !decoded.id) {
      return NextResponse.json({ success: false, message: 'Invalid token payload.' }, { status: 401 });
    }

    const user = await findUserById(decoded.id);

    if (!user) {
      // This case might mean the user was deleted after the token was issued.
      // Invalidate the cookie.
      const expiredCookie = serialize(COOKIE_NAME, '', { httpOnly: true, maxAge: 0, path: '/' });
      const response = NextResponse.json({ success: false, message: 'User not found.' }, { status: 401 });
      response.headers.set('Set-Cookie', expiredCookie);
      return response;
    }
    
    // Return only non-sensitive user data
    const userProfile: UserProfile = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
    };

    return NextResponse.json({ success: true, user: userProfile }, { status: 200 });

  } catch (error: any) {
    console.error('Error verifying token or fetching user:', error.message);
    // If token is expired or invalid, clear it.
     const expiredCookie = serialize(COOKIE_NAME, '', { httpOnly: true, maxAge: 0, path: '/' });
     const response = NextResponse.json({ success: false, message: 'Invalid or expired token.' }, { status: 401 });
     response.headers.set('Set-Cookie', expiredCookie);
     return response;
  }
}

// Helper function, not directly used by GET but good for type consistency
// if you were to re-use token parsing logic elsewhere.
function serialize(arg0: string, arg1: string, arg2: { httpOnly: boolean; maxAge: number; path: string; }): string | ReadableStream<Uint8Array> | null {
    // Simplified serialize, production would use 'cookie' package's serialize
    return `${arg0}=${arg1}; HttpOnly; Max-Age=${arg2.maxAge}; Path=${arg2.path}`;
}
