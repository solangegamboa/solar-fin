
import { NextResponse, type NextRequest } from 'next/server';
// import jwt from 'jsonwebtoken'; // No longer using jwt directly here, moved to authUtils
// import { cookies } from 'next/headers'; // No longer using cookies
import { addTransaction } from '@/lib/databaseService';
import type { NewTransactionData, AddTransactionResult } from '@/types';
import { getUserIdFromAuthHeader } from '@/lib/authUtils'; // Import new utility

// const JWT_SECRET = process.env.JWT_SECRET; // Moved to authUtils
// const COOKIE_NAME = 'authToken'; // No longer using cookies

// Removed authenticateUser function, will use getUserIdFromAuthHeader

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const transactionData = await req.json() as NewTransactionData;

    if (!transactionData.type || !transactionData.amount || !transactionData.category || !transactionData.date) {
        return NextResponse.json({ success: false, message: 'Missing required transaction fields.' }, { status: 400 });
    }
    if (transactionData.amount <= 0) {
        return NextResponse.json({ success: false, message: 'Amount must be positive.' }, { status: 400 });
    }

    const result: AddTransactionResult = await addTransaction(userId, transactionData);

    if (result.success && result.transactionId) {
      return NextResponse.json({ success: true, transactionId: result.transactionId, message: 'Transaction added successfully.' }, { status: 201 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to add transaction.' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Add transaction API error:', error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ success: false, message: 'Invalid JSON payload.' }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
