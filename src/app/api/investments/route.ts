
import { NextResponse, type NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { addInvestment, getInvestmentsForUser } from '@/lib/databaseService';
import type { UserProfile, NewInvestmentData, Investment } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'authToken';

async function authenticateUser(req: NextRequest): Promise<UserProfile | null> {
  if (!JWT_SECRET) {
    console.error('AUTH_ERROR: JWT_SECRET is not set in /api/investments/route.ts');
    return null;
  }
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    console.error('AUTH_ERROR: Auth token cookie not found in /api/investments/route.ts. Headers:', JSON.stringify(Object.fromEntries(req.headers)));
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as (Pick<UserProfile, 'id'> & {iat: number, exp: number});
    if (decoded && decoded.id) {
      // console.log('AUTH_SUCCESS: User authenticated in /api/investments/route.ts, UserId:', decoded.id);
      return { id: decoded.id, email: '' }; // email not needed here
    }
    console.error('AUTH_ERROR: JWT decoded but no ID found in /api/investments/route.ts');
    return null;
  } catch (error: any) {
     console.error('AUTH_ERROR: JWT verification failed in /api/investments/route.ts. Error:', error.message);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const investmentData = await req.json() as NewInvestmentData;
    
    if (!investmentData.name || typeof investmentData.currentValue !== 'number') {
        return NextResponse.json({ success: false, message: 'Name and current value are required.' }, { status: 400 });
    }
    if (investmentData.currentValue < 0) {
        return NextResponse.json({ success: false, message: 'Current value cannot be negative.' }, { status: 400 });
    }
    if (investmentData.initialAmount !== undefined && investmentData.initialAmount != null && investmentData.initialAmount < 0) {
        return NextResponse.json({ success: false, message: 'Initial amount cannot be negative.' }, { status: 400 });
    }
     if (investmentData.quantity !== undefined && investmentData.quantity != null && investmentData.quantity < 0) {
        return NextResponse.json({ success: false, message: 'Quantity cannot be negative.' }, { status: 400 });
    }


    const result = await addInvestment(user.id, investmentData);
    if (result.success && result.investmentId) {
      return NextResponse.json({ success: true, investmentId: result.investmentId, message: 'Investment added successfully.' }, { status: 201 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to add investment.' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Add investment error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const investments: Investment[] = await getInvestmentsForUser(user.id);
    return NextResponse.json({ success: true, investments }, { status: 200 });
  } catch (error: any) {
    console.error('Get investments error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
