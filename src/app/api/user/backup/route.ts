
import { NextResponse, type NextRequest } from 'next/server';
// import jwt from 'jsonwebtoken'; // Moved to authUtils
// import { cookies } from 'next/headers'; // No longer using cookies
import { getUserBackupData, findUserById } from '@/lib/databaseService'; // Added findUserById
import { getUserIdFromAuthHeader } from '@/lib/authUtils';
import { format } from 'date-fns';

// const JWT_SECRET = process.env.JWT_SECRET; // Moved to authUtils
// const COOKIE_NAME = 'authToken'; // No longer using cookies

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    // We need the user's email for the filename, so fetch the profile.
    const userProfile = await findUserById(userId);
    if (!userProfile || !userProfile.email) {
      return NextResponse.json({ success: false, message: 'User profile or email not found.' }, { status: 404 });
    }

    const backupData = await getUserBackupData(userId);

    if (!backupData) {
      return NextResponse.json({ success: false, message: 'Could not retrieve backup data.' }, { status: 500 });
    }
    
    const userEmailPrefix = userProfile.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const filename = `solar_fin_backup_${userEmailPrefix}_${timestamp}.json`;

    const response = NextResponse.json(backupData, { status: 200 });
    response.headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    return response;

  } catch (error: any) {
    console.error('Backup error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred during backup.' }, { status: 500 });
  }
}
