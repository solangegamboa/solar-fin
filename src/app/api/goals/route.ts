
import { NextResponse, type NextRequest } from 'next/server';
// import jwt from 'jsonwebtoken'; // Moved to authUtils
// import { cookies } from 'next/headers'; // No longer using cookies
import { addFinancialGoal, getFinancialGoalsForUser } from '@/lib/databaseService';
import type { NewFinancialGoalData, FinancialGoal } from '@/types';
import { getUserIdFromAuthHeader } from '@/lib/authUtils';

// Removed authenticateUser function

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const goalData = await req.json() as NewFinancialGoalData;
    if (!goalData.name || typeof goalData.targetAmount !== 'number' || goalData.targetAmount <= 0) {
        return NextResponse.json({ success: false, message: 'Name and positive target amount are required.' }, { status: 400 });
    }

    const result = await addFinancialGoal(userId, goalData);
    if (result.success && result.goalId) {
      return NextResponse.json({ success: true, goalId: result.goalId, message: 'Financial goal added successfully.' }, { status: 201 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to add financial goal.' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Add financial goal error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const goals: FinancialGoal[] = await getFinancialGoalsForUser(userId);
    return NextResponse.json({ success: true, goals }, { status: 200 });
  } catch (error: any) {
    console.error('Get financial goals error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
