
import { NextResponse, type NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { updateFinancialGoal, deleteFinancialGoal } from '@/lib/databaseService';
import type { UserProfile, UpdateFinancialGoalData } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'authToken';

async function authenticateUser(req: NextRequest): Promise<UserProfile | null> {
  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not set');
    return null;
  }
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as (Pick<UserProfile, 'id'> & {iat: number, exp: number});
    return decoded && decoded.id ? { id: decoded.id, email: '' } : null;
  } catch (error) {
    return null;
  }
}

interface RouteParams {
  params: {
    goalId: string;
  };
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await authenticateUser(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }
  const { goalId } = params;
  if (!goalId) {
    return NextResponse.json({ success: false, message: 'Goal ID is required.' }, { status: 400 });
  }

  try {
    const updateData = await req.json() as UpdateFinancialGoalData;
    // Add more specific validation for updateData if needed
    if (updateData.targetAmount !== undefined && updateData.targetAmount <= 0) {
        return NextResponse.json({ success: false, message: 'Target amount must be positive.' }, { status: 400 });
    }
    if (updateData.currentAmount !== undefined && updateData.currentAmount < 0) {
        return NextResponse.json({ success: false, message: 'Current amount cannot be negative.' }, { status: 400 });
    }


    const result = await updateFinancialGoal(user.id, goalId, updateData);
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
  const user = await authenticateUser(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }
  const { goalId } = params;
  if (!goalId) {
    return NextResponse.json({ success: false, message: 'Goal ID is required.' }, { status: 400 });
  }

  try {
    const result = await deleteFinancialGoal(user.id, goalId);
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
