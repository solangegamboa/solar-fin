
import { NextResponse, type NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { updateUserEmailNotificationPreference } from '@/lib/databaseService';
import type { UserProfile, UpdateEmailNotificationPrefsData } from '@/types';

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

    const { notifyByEmail } = await req.json() as UpdateEmailNotificationPrefsData;

    if (typeof notifyByEmail !== 'boolean') {
      return NextResponse.json({ success: false, message: 'Invalid value for notifyByEmail. Must be true or false.' }, { status: 400 });
    }

    const result = await updateUserEmailNotificationPreference(userId, notifyByEmail);

    if (result.success && result.user) {
      // Return the updated user profile which includes the new preference
      return NextResponse.json({ success: true, user: result.user }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to update email notification preference.' }, { status: result.error === 'User not found.' ? 404 : 500 });
    }

  } catch (error: any) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        return NextResponse.json({ success: false, message: 'Invalid or expired token.' }, { status: 401 });
    }
    console.error('Update email notification preference error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
