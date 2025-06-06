
import { NextResponse, type NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { restoreUserBackupData } from '@/lib/databaseService';
import type { UserProfile, UserBackupData } from '@/types';

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

  let userId: string;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as (Pick<UserProfile, 'id'> & {iat: number, exp: number});
    if (!decoded || !decoded.id) {
      return NextResponse.json({ success: false, message: 'Invalid token payload.' }, { status: 401 });
    }
    userId = decoded.id;
  } catch (error: any) {
     if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        return NextResponse.json({ success: false, message: 'Invalid or expired token.' }, { status: 401 });
    }
    console.error('Token verification error during restore:', error);
    return NextResponse.json({ success: false, message: 'Authentication error.' }, { status: 401 });
  }

  try {
    const backupData = await req.json() as UserBackupData;

    // Basic validation of backup data structure
    if (
      !backupData ||
      typeof backupData.profile !== 'object' ||
      !Array.isArray(backupData.transactions) ||
      !Array.isArray(backupData.loans) ||
      !Array.isArray(backupData.creditCards) ||
      !Array.isArray(backupData.creditCardPurchases) ||
      !Array.isArray(backupData.categories)
    ) {
      return NextResponse.json({ success: false, message: 'Invalid backup file format.' }, { status: 400 });
    }

    const result = await restoreUserBackupData(userId, backupData);

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Data restored successfully.' }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to restore data.' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Restore error:', error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ success: false, message: 'Invalid JSON in backup file.' }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'An internal server error occurred during restore.' }, { status: 500 });
  }
}
