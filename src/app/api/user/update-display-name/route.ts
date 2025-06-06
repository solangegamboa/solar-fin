
import { NextResponse, type NextRequest } from 'next/server';
// import jwt from 'jsonwebtoken'; // Moved to authUtils
// import { cookies } from 'next/headers'; // No longer using cookies
import { updateUserDisplayName } from '@/lib/databaseService';
// import type { UserProfile, AuthApiResponse } from '@/types'; // AuthApiResponse not directly used, but UserProfile parts are
import { getUserIdFromAuthHeader } from '@/lib/authUtils';

// const JWT_SECRET = process.env.JWT_SECRET; // Moved to authUtils
// const COOKIE_NAME = 'authToken'; // No longer using cookies

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const { displayName } = await req.json();

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      return NextResponse.json({ success: false, message: 'Display name is required.' }, { status: 400 });
    }
    if (displayName.length > 50) {
      return NextResponse.json({ success: false, message: 'Display name cannot exceed 50 characters.' }, { status: 400 });
    }

    const result = await updateUserDisplayName(userId, displayName.trim());

    if (result.success && result.user) {
      // Return the updated user profile which includes the new name
      // The client's AuthContext will use this to update its local user state
      return NextResponse.json({ success: true, user: result.user }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to update display name.' }, { status: result.error === 'User not found.' ? 404 : 500 });
    }

  } catch (error: any) {
    console.error('Update display name error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
