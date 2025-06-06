
import { NextResponse, type NextRequest } from 'next/server';
// import jwt from 'jsonwebtoken'; // Moved to authUtils
// import { cookies } from 'next/headers'; // No longer using cookies
import { updateFinancialGoal, deleteFinancialGoal } from '@/lib/databaseService';
import type { UpdateFinancialGoalData } from '@/types';
import { getUserIdFromAuthHeader } from '@/lib/authUtils';

// Removed authenticateUser function

interface RouteParams {
  params: {
    goalId: string;
  };
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }
  const { goalId } = params;
  if (!goalId) {
    return NextResponse.json({ success: false, message: 'Goal ID is required.' }, { status: 400 });
  }

  try {
    const updateData = await req.json() as UpdateFinancialGoalData;
    if (updateData.targetAmount !== undefined && updateData.targetAmount <= 0) {
        return NextResponse.json({ success: false, message: 'Target amount must be positive.' }, { status: 400 });
    }
    if (updateData.currentAmount !== undefined && updateData.currentAmount < 0) {
        return NextResponse.json({ success: false, message: 'Current amount cannot be negative.' }, { status: 400 });
    }

    const result = await updateFinancialGoal(userId, goalId, updateData);
    if (result.success) {
      return NextResponse.json({ success: true, message: 'Financial goal updated successfully.' }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to update financial goal.' }, { status: result.error?.includes("not found") ? 404 : 500 });
    }
  } catch (error: any) {
    console.error('Update financial goal error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }
  const { goalId } = params;
  if (!goalId) {
    return NextResponse.json({ success: false, message: 'Goal ID is required.' }, { status: 400 });
  }

  try {
    const result = await deleteFinancialGoal(userId, goalId);
    if (result.success) {
      return NextResponse.json({ success: true, message: 'Financial goal deleted successfully.' }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to delete financial goal.' }, { status: result.error?.includes("not found") ? 404 : 500 });
    }
  } catch (error: any) {
    console.error('Delete financial goal error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
