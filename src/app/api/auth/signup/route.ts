
import { NextResponse, type NextRequest } from 'next/server';
import { createUser, findUserByEmail } from '@/lib/databaseService';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
import type { UserProfile } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'authToken';

export async function POST(req: NextRequest) {
  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not set');
    return NextResponse.json({ success: false, message: 'Server configuration error.' }, { status: 500 });
  }

  try {
    const { email, password, displayName } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email and password are required.' }, { status: 400 });
    }
    
    // Basic email validation
    if (!/\S+@\S+\.\S+/.test(email)) {
        return NextResponse.json({ success: false, message: 'Invalid email format.' }, { status: 400 });
    }
    if (password.length < 6) {
        return NextResponse.json({ success: false, message: 'Password must be at least 6 characters long.' }, { status: 400 });
    }


    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return NextResponse.json({ success: false, message: 'User with this email already exists.' }, { status: 409 });
    }

    const newUser = await createUser(email, password, displayName);
    if (!newUser) {
      return NextResponse.json({ success: false, message: 'Failed to create user.' }, { status: 500 });
    }

    const userPayload: Pick<UserProfile, 'id' | 'email' | 'displayName'> = {
      id: newUser.id,
      email: newUser.email,
      displayName: newUser.displayName,
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' }); // Token JWT válido por 7 dias

    const cookie = serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // Cookie válido por 1 semana (7 dias)
      path: '/',
      sameSite: 'lax',
    });

    const response = NextResponse.json< { success: boolean; user: typeof userPayload } >(
        { success: true, user: userPayload },
        { status: 201 }
    );
    response.headers.set('Set-Cookie', cookie);
    return response;

  } catch (error: any) {
    console.error('Signup error:', error);
    // Handle specific error for existing user from createUser
    if (error.message === 'User with this email already exists.') {
        return NextResponse.json({ success: false, message: 'User with this email already exists.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: error.message || 'An internal server error occurred.' }, { status: 500 });
  }
}
