
import { NextResponse, type NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { updateUserDisplayName } from '@/lib/databaseService';
import type { UserProfile, AuthApiResponse } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'authToken';

export async function POST(req: NextRequest) {
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
    const userId = decoded.id;

    const { displayName } = await req.json();

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      return NextResponse.json({ success: false, message: 'Display name is required.' }, { status: 400 });
    }
    if (displayName.length > 50) {
      return NextResponse.json({ success: false, message: 'Display name cannot exceed 50 characters.' }, { status: 400 });
    }

    const result = await updateUserDisplayName(userId, displayName.trim());

    if (result.success && result.user) {
      return NextResponse.json({ success: true, user: result.user }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to update display name.' }, { status: result.error === 'User not found.' ? 404 : 500 });
    }

  } catch (error: any) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        return NextResponse.json({ success: false, message: 'Invalid or expired token.' }, { status: 401 });
    }
    console.error('Update display name error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
