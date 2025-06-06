
import { NextResponse, type NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { updateCreditCardPurchase, deleteCreditCardPurchase } from '@/lib/databaseService';
import type { UserProfile, UpdateCreditCardPurchaseData, UpdateResult } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'authToken';

async function authenticateUser(req: NextRequest): Promise<UserProfile | null> {
  if (!JWT_SECRET) {
    console.error('AUTH_ERROR: JWT_SECRET is not set in /api/credit-card-purchases/[purchaseId]/route.ts');
    return null;
  }
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    console.error('AUTH_ERROR: Auth token cookie not found. Headers:', JSON.stringify(Object.fromEntries(req.headers)));
    return null;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as (Pick<UserProfile, 'id'> & {iat: number, exp: number});
    if (decoded && decoded.id) {
      return { id: decoded.id, email: '' };
    }
    console.error('AUTH_ERROR: JWT decoded but no ID found.');
    return null;
  } catch (error: any) {
    console.error('AUTH_ERROR: JWT verification failed. Error:', error.message);
    return null;
  }
}

interface RouteParams {
  params: {
    purchaseId: string;
  };
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await authenticateUser(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }
  const { purchaseId } = params;
  if (!purchaseId) {
    return NextResponse.json({ success: false, message: 'Purchase ID is required.' }, { status: 400 });
  }

  try {
    const updateData = await req.json() as UpdateCreditCardPurchaseData;
    // Add more specific validation for updateData if needed
    if (updateData.totalAmount !== undefined && updateData.totalAmount <= 0) {
        return NextResponse.json({ success: false, message: 'Total amount must be positive.' }, { status: 400 });
    }
     if (updateData.installments !== undefined && (updateData.installments <= 0 || !Number.isInteger(updateData.installments))) {
        return NextResponse.json({ success: false, message: 'Installments must be a positive integer.' }, { status: 400 });
    }


    const result: UpdateResult = await updateCreditCardPurchase(user.id, purchaseId, updateData);
    if (result.success) {
      return NextResponse.json({ success: true, message: 'Credit card purchase updated successfully.' }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to update credit card purchase.' }, { status: result.error?.includes("not found") ? 404 : 500 });
    }
  } catch (error: any) {
    console.error('Update credit card purchase error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const user = await authenticateUser(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }
  const { purchaseId } = params;
  if (!purchaseId) {
    return NextResponse.json({ success: false, message: 'Purchase ID is required.' }, { status: 400 });
  }

  try {
    const result: UpdateResult = await deleteCreditCardPurchase(user.id, purchaseId);
    if (result.success) {
      return NextResponse.json({ success: true, message: 'Credit card purchase deleted successfully.' }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to delete credit card purchase.' }, { status: result.error?.includes("not found") ? 404 : 500 });
    }
  } catch (error: any) {
    console.error('Delete credit card purchase error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
