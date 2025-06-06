
import { NextResponse, type NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { addTransaction } from '@/lib/databaseService';
import type { UserProfile, NewTransactionData, AddTransactionResult } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'authToken';

async function authenticateUser(req: NextRequest): Promise<UserProfile | null> {
  if (!JWT_SECRET) {
    console.error('AUTH_ERROR: JWT_SECRET is not set in /api/transactions/route.ts POST');
    return null;
  }
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    console.error('AUTH_ERROR: Auth token cookie not found in /api/transactions/route.ts POST');
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as (Pick<UserProfile, 'id'> & {iat: number, exp: number});
    if (decoded && decoded.id) {
      return { id: decoded.id, email: '' }; // email not needed for this operation
    }
    console.error('AUTH_ERROR: JWT decoded but no ID found in /api/transactions/route.ts POST');
    return null;
  } catch (error: any) {
    console.error('AUTH_ERROR: JWT verification failed in /api/transactions/route.ts POST. Error:', error.message);
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
