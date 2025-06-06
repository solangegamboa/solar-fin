
import { NextResponse, type NextRequest } from 'next/server';
// import jwt from 'jsonwebtoken'; // Moved to authUtils
// import { cookies } from 'next/headers'; // No longer using cookies
import { restoreUserBackupData } from '@/lib/databaseService';
import type { UserBackupData } from '@/types';
import { getUserIdFromAuthHeader } from '@/lib/authUtils';

// const JWT_SECRET = process.env.JWT_SECRET; // Moved to authUtils
// const COOKIE_NAME = 'authToken'; // No longer using cookies

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const backupData = await req.json() as UserBackupData;

    if (
      !backupData ||
      typeof backupData.profile !== 'object' ||
      !Array.isArray(backupData.transactions) ||
      !Array.isArray(backupData.loans) ||
      !Array.isArray(backupData.creditCards) ||
      !Array.isArray(backupData.creditCardPurchases) ||
      !Array.isArray(backupData.categories) ||
      !Array.isArray(backupData.financialGoals) || // Added check
      !Array.isArray(backupData.investments)     // Added check
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
