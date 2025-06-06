
import { NextResponse, type NextRequest } from 'next/server';
// import jwt from 'jsonwebtoken'; // Moved to authUtils
// import { cookies } from 'next/headers'; // No longer using cookies
import { updateCreditCardPurchase, deleteCreditCardPurchase } from '@/lib/databaseService';
import type { UpdateCreditCardPurchaseData, UpdateResult } from '@/types';
import { getUserIdFromAuthHeader } from '@/lib/authUtils'; // Import new utility

// Removed authenticateUser function

interface RouteParams {
  params: {
    purchaseId: string;
  };
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }
  const { purchaseId } = params;
  if (!purchaseId) {
    return NextResponse.json({ success: false, message: 'Purchase ID is required.' }, { status: 400 });
  }

  try {
    const updateData = await req.json() as UpdateCreditCardPurchaseData;
    if (updateData.totalAmount !== undefined && updateData.totalAmount <= 0) {
        return NextResponse.json({ success: false, message: 'Total amount must be positive.' }, { status: 400 });
    }
     if (updateData.installments !== undefined && (updateData.installments <= 0 || !Number.isInteger(updateData.installments))) {
        return NextResponse.json({ success: false, message: 'Installments must be a positive integer.' }, { status: 400 });
    }

    const result: UpdateResult = await updateCreditCardPurchase(userId, purchaseId, updateData);
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
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }
  const { purchaseId } = params;
  if (!purchaseId) {
    return NextResponse.json({ success: false, message: 'Purchase ID is required.' }, { status: 400 });
  }

  try {
    const result: UpdateResult = await deleteCreditCardPurchase(userId, purchaseId);
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
