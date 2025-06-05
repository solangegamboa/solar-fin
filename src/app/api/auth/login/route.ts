
import { NextResponse, type NextRequest } from 'next/server';
import { findUserByEmail, updateUserLastLogin } from '@/lib/databaseService';
import bcrypt from 'bcryptjs';
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
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email and password are required.' }, { status: 400 });
    }

    const user = await findUserByEmail(email);

    if (!user || !user.hashedPassword) {
      return NextResponse.json({ success: false, message: 'Invalid email or password.' }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);

    if (!isPasswordValid) {
      return NextResponse.json({ success: false, message: 'Invalid email or password.' }, { status: 401 });
    }

    await updateUserLastLogin(user.id);

    const userPayload: Pick<UserProfile, 'id' | 'email' | 'displayName'> = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };
    
    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

    const cookie = serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
      sameSite: 'lax',
    });

    const response = NextResponse.json<{ success: boolean; user: typeof userPayload }>(
        { success: true, user: userPayload },
        { status: 200 }
    );
    response.headers.set('Set-Cookie', cookie);
    return response;

  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, message: error.message || 'An internal server error occurred.' }, { status: 500 });
  }
}
