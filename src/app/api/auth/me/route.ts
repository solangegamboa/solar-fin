
import { NextResponse, type NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
// import { cookies } from 'next/headers'; // No longer reading from cookies
import { findUserById } from '@/lib/databaseService';
import type { UserProfile } from '@/types';
import { getUserIdFromAuthHeader } from '@/lib/authUtils'; // Import new utility

const JWT_SECRET = process.env.JWT_SECRET;
// const COOKIE_NAME = 'authToken'; // No longer used

export async function GET(req: NextRequest) {
  if (!JWT_SECRET) { // JWT_SECRET check is also in getUserIdFromAuthHeader but doesn't hurt here
    console.error('JWT_SECRET is not set in /api/auth/me');
    return NextResponse.json({ success: false, message: 'Server configuration error.' }, { status: 500 });
  }

  const userId = await getUserIdFromAuthHeader(req);

  if (!userId) {
    // getUserIdFromAuthHeader handles logging for token issues
    return NextResponse.json({ success: false, message: 'Not authenticated or invalid token.' }, { status: 401 });
  }

  try {
    const user = await findUserById(userId);

    if (!user) {
      // This case might mean the user was deleted after the token was issued.
      // Client side should handle this by clearing localStorage token if /me fails.
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 401 });
    }
    
    const userProfile: UserProfile = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        notifyByEmail: user.notifyByEmail,
    };

    return NextResponse.json({ success: true, user: userProfile }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching user by ID in /api/auth/me:', error.message);
    return NextResponse.json({ success: false, message: 'Error retrieving user profile.' }, { status: 500 });
  }
}
