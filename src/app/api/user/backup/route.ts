
import { NextResponse, type NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { getUserBackupData } from '@/lib/databaseService';
import type { UserProfile } from '@/types';
import { format } from 'date-fns';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'authToken';

export async function GET(req: NextRequest) {
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
    const decoded = jwt.verify(token, JWT_SECRET) as (Pick<UserProfile, 'id' | 'email'> & {iat: number, exp: number});
    if (!decoded || !decoded.id) {
      return NextResponse.json({ success: false, message: 'Invalid token payload.' }, { status: 401 });
    }
    const userId = decoded.id;

    const backupData = await getUserBackupData(userId);

    if (!backupData) {
      return NextResponse.json({ success: false, message: 'Could not retrieve backup data.' }, { status: 500 });
    }
    
    const userEmailPrefix = decoded.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const filename = `solar_fin_backup_${userEmailPrefix}_${timestamp}.json`;

    // Return data as JSON, frontend will handle download
    const response = NextResponse.json(backupData, { status: 200 });
    response.headers.set('Content-Disposition', `attachment; filename="${filename}"`); // Suggest filename
    return response;

  } catch (error: any) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        return NextResponse.json({ success: false, message: 'Invalid or expired token.' }, { status: 401 });
    }
    console.error('Backup error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred during backup.' }, { status: 500 });
  }
}
