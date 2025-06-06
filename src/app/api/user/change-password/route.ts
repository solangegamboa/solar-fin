
import { NextResponse, type NextRequest } from 'next/server';
// import jwt from 'jsonwebtoken'; // Moved to authUtils
// import { cookies } from 'next/headers'; // No longer using cookies
import { updateUserPassword } from '@/lib/databaseService';
// import type { UserProfile } from '@/types'; // Not strictly needed here
import { getUserIdFromAuthHeader } from '@/lib/authUtils';

// const JWT_SECRET = process.env.JWT_SECRET; // Moved to authUtils
// const COOKIE_NAME = 'authToken'; // No longer using cookies

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
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
    console.error('Change password error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
