
import { NextResponse, type NextRequest } from 'next/server';
// import jwt from 'jsonwebtoken'; // Moved to authUtils
// import { cookies } from 'next/headers'; // No longer using cookies
import { updateUserEmailNotificationPreference } from '@/lib/databaseService';
import type { UpdateEmailNotificationPrefsData } from '@/types';
import { getUserIdFromAuthHeader } from '@/lib/authUtils';

// const JWT_SECRET = process.env.JWT_SECRET; // Moved to authUtils
// const COOKIE_NAME = 'authToken'; // No longer using cookies

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const { notifyByEmail } = await req.json() as UpdateEmailNotificationPrefsData;

    if (typeof notifyByEmail !== 'boolean') {
      return NextResponse.json({ success: false, message: 'Invalid value for notifyByEmail. Must be true or false.' }, { status: 400 });
    }

    const result = await updateUserEmailNotificationPreference(userId, notifyByEmail);

    if (result.success && result.user) {
      return NextResponse.json({ success: true, user: result.user }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to update email notification preference.' }, { status: result.error === 'User not found.' ? 404 : 500 });
    }

  } catch (error: any) {
    console.error('Update email notification preference error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
