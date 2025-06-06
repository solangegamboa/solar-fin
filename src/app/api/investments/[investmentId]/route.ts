
import { NextResponse, type NextRequest } from 'next/server';
// import jwt from 'jsonwebtoken'; // Moved to authUtils
// import { cookies } from 'next/headers'; // No longer using cookies
import { updateInvestment, deleteInvestment } from '@/lib/databaseService';
import type { UpdateInvestmentData } from '@/types';
import { getUserIdFromAuthHeader } from '@/lib/authUtils';

// Removed authenticateUser function

interface RouteParams {
  params: {
    investmentId: string;
  };
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
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

    const result = await updateInvestment(userId, investmentId, updateData);
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
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }
  const { investmentId } = params;
  if (!investmentId) {
    return NextResponse.json({ success: false, message: 'Investment ID is required.' }, { status: 400 });
  }

  try {
    const result = await deleteInvestment(userId, investmentId);
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
