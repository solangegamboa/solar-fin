
import { NextResponse, type NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { updateInvestment, deleteInvestment } from '@/lib/databaseService';
import type { UserProfile, UpdateInvestmentData } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'authToken';

async function authenticateUser(req: NextRequest): Promise<UserProfile | null> {
  if (!JWT_SECRET) {
    console.error('AUTH_ERROR: JWT_SECRET is not set in /api/investments/[investmentId]/route.ts');
    return null;
  }
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
     console.error('AUTH_ERROR: Auth token cookie not found in /api/investments/[investmentId]/route.ts. Headers:', JSON.stringify(Object.fromEntries(req.headers)));
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as (Pick<UserProfile, 'id'> & {iat: number, exp: number});
    if (decoded && decoded.id) {
      // console.log('AUTH_SUCCESS: User authenticated in /api/investments/[investmentId]/route.ts, UserId:', decoded.id);
      return { id: decoded.id, email: '' };
    }
    console.error('AUTH_ERROR: JWT decoded but no ID found in /api/investments/[investmentId]/route.ts');
    return null;
  } catch (error: any) {
    console.error('AUTH_ERROR: JWT verification failed in /api/investments/[investmentId]/route.ts. Error:', error.message);
    return null;
  }
}

interface RouteParams {
  params: {
    investmentId: string;
  };
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await authenticateUser(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }
  const { investmentId } = params;
  if (!investmentId) {
    return NextResponse.json({ success: false, message: 'Investment ID is required.' }, { status: 400 });
  }

  try {
    const updateData = await req.json() as UpdateInvestmentData;
    
    if (updateData.currentValue !== undefined && updateData.currentValue < 0) {
        return NextResponse.json({ success: false, message: 'Current value cannot be negative.' }, { status: 400 });
    }
    if (updateData.initialAmount !== undefined && updateData.initialAmount != null && updateData.initialAmount < 0) {
        return NextResponse.json({ success: false, message: 'Initial amount cannot be negative.' }, { status: 400 });
    }
    if (updateData.quantity !== undefined && updateData.quantity != null && updateData.quantity < 0) {
        return NextResponse.json({ success: false, message: 'Quantity cannot be negative.' }, { status: 400 });
    }

    const result = await updateInvestment(user.id, investmentId, updateData);
    if (result.success) {
      return NextResponse.json({ success: true, message: 'Investment updated successfully.' }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to update investment.' }, { status: result.error?.includes("not found") ? 404 : 500 });
    }
  } catch (error: any) {
    console.error('Update investment error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const user = await authenticateUser(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }
  const { investmentId } = params;
  if (!investmentId) {
    return NextResponse.json({ success: false, message: 'Investment ID is required.' }, { status: 400 });
  }

  try {
    const result = await deleteInvestment(user.id, investmentId);
    if (result.success) {
      return NextResponse.json({ success: true, message: 'Investment deleted successfully.' }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to delete investment.' }, { status: result.error?.includes("not found") ? 404 : 500 });
    }
  } catch (error: any) {
    console.error('Delete investment error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
