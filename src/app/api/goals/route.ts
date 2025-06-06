
import { NextResponse, type NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { addFinancialGoal, getFinancialGoalsForUser } from '@/lib/databaseService';
import type { UserProfile, NewFinancialGoalData, FinancialGoal } from '@/types';

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
    return decoded && decoded.id ? { id: decoded.id, email: '' } : null; // email not needed here, just id
  } catch (error) {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const goalData = await req.json() as NewFinancialGoalData;
    // Basic validation
    if (!goalData.name || typeof goalData.targetAmount !== 'number' || goalData.targetAmount <= 0) {
        return NextResponse.json({ success: false, message: 'Name and positive target amount are required.' }, { status: 400 });
    }

    const result = await addFinancialGoal(user.id, goalData);
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
  const user = await authenticateUser(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const goals: FinancialGoal[] = await getFinancialGoalsForUser(user.id);
    return NextResponse.json({ success: true, goals }, { status: 200 });
  } catch (error: any) {
    console.error('Get financial goals error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
