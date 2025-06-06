
import { NextResponse, type NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { updateUserPassword } from '@/lib/databaseService';
import type { UserProfile } from '@/types'; // AuthApiResponse can be used for simple success/error

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

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, message: 'Current and new passwords are required.' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ success: false, message: 'New password must be at least 6 characters long.' }, { status: 400 });
    }

    const result = await updateUserPassword(userId, currentPassword, newPassword);

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Password updated successfully.' }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to update password.' }, { status: result.error === 'Invalid current password.' ? 400 : (result.error === 'User not found.' ? 404 : 500) });
    }

  } catch (error: any) {
     if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        return NextResponse.json({ success: false, message: 'Invalid or expired token.' }, { status: 401 });
    }
    console.error('Change password error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
