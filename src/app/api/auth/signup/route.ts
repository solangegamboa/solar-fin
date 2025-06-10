
import { NextResponse, type NextRequest } from 'next/server';
import { createUser, findUserByEmail } from '@/lib/databaseService';
import jwt from 'jsonwebtoken';
// import { serialize } from 'cookie'; // No longer serializing cookie
import type { UserProfile } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET;
// const COOKIE_NAME = 'authToken'; // Cookie no longer used here

export async function POST(req: NextRequest) {
  // Check if new signups are allowed
  const allowNewSignups = process.env.ALLOW_NEW_SIGNUPS === 'true';
  if (!allowNewSignups) {
    return NextResponse.json({ success: false, message: 'Novos cadastros estão temporariamente desabilitados.' }, { status: 403 });
  }

  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not set');
    return NextResponse.json({ success: false, message: 'Server configuration error.' }, { status: 500 });
  }

  try {
    const { email, password, displayName } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email and password are required.' }, { status: 400 });
    }
    
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

    const userPayload: Pick<UserProfile, 'id' | 'email' | 'displayName' | 'notifyByEmail'> = {
      id: newUser.id,
      email: newUser.email,
      displayName: newUser.displayName,
      notifyByEmail: newUser.notifyByEmail,
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

    // Remove cookie setting, return token in body
    const response = NextResponse.json< { success: boolean; user: typeof userPayload; token: string } >(
        { success: true, user: userPayload, token: token },
        { status: 201 }
    );
    // response.headers.set('Set-Cookie', cookie); // Removed cookie setting
    return response;

  } catch (error: any) {
    console.error('Signup error:', error);
    if (error.message === 'User with this email already exists.') {
        return NextResponse.json({ success: false, message: 'User with this email already exists.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: error.message || 'An internal server error occurred.' }, { status: 500 });
  }
}

