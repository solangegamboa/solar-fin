
import { NextResponse, type NextRequest } from 'next/server';
// import jwt from 'jsonwebtoken'; // Moved to authUtils
// import { cookies } from 'next/headers'; // No longer using cookies
import { addInvestment, getInvestmentsForUser } from '@/lib/databaseService';
import type { NewInvestmentData, Investment } from '@/types';
import { getUserIdFromAuthHeader } from '@/lib/authUtils';

// Removed authenticateUser function

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
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

    const result = await addInvestment(userId, investmentData);
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
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const investments: Investment[] = await getInvestmentsForUser(userId);
    return NextResponse.json({ success: true, investments }, { status: 200 });
  } catch (error: any) {
    console.error('Get investments error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
