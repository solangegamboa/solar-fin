
import { NextResponse, type NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { addTransaction } from '@/lib/databaseService';
import type { UserProfile, NewTransactionData, AddTransactionResult } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'authToken';

async function authenticateUser(req: NextRequest): Promise<UserProfile | null> {
  if (!JWT_SECRET) {
    console.error('CRITICAL_AUTH_ERROR: JWT_SECRET is not set in environment for /api/transactions/route.ts POST. Authentication will fail.');
    return null;
  }
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    console.warn('AUTH_WARN: Auth token cookie (authToken) not found in request to /api/transactions/route.ts POST. User is likely not logged in or cookie was cleared.');
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as (Pick<UserProfile, 'id'> & {iat: number, exp: number});
    if (decoded && decoded.id) {
      // console.log('AUTH_SUCCESS: User authenticated for /api/transactions/route.ts POST. UserID:', decoded.id);
      return { id: decoded.id, email: '' }; // email not needed for this operation
    }
    console.error('AUTH_ERROR: JWT decoded but no ID found in payload for /api/transactions/route.ts POST. Token payload:', JSON.stringify(decoded));
    return null;
  } catch (error: any) {
    if (error instanceof jwt.TokenExpiredError) {
      console.warn('AUTH_WARN: JWT token expired for /api/transactions/route.ts POST. Error:', error.message);
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.warn('AUTH_WARN: JWT verification failed (e.g., malformed, invalid signature) for /api/transactions/route.ts POST. Error:', error.message);
    } else {
      console.error('AUTH_ERROR: Unexpected error during JWT verification for /api/transactions/route.ts POST. Error:', error.message);
    }
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user || !user.id) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const transactionData = await req.json() as NewTransactionData;

    // Basic validation
    if (!transactionData.type || !transactionData.amount || !transactionData.category || !transactionData.date) {
        return NextResponse.json({ success: false, message: 'Missing required transaction fields.' }, { status: 400 });
    }
    if (transactionData.amount <= 0) {
        return NextResponse.json({ success: false, message: 'Amount must be positive.' }, { status: 400 });
    }


    const result: AddTransactionResult = await addTransaction(user.id, transactionData);

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
