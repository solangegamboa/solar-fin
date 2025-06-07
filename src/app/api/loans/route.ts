
import { NextResponse, type NextRequest } from 'next/server';
import { addLoan, getLoansForUser } from '@/lib/databaseService';
import type { NewLoanData, Loan, AddLoanResult } from '@/types';
import { getUserIdFromAuthHeader } from '@/lib/authUtils';

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const loanData = await req.json() as NewLoanData;

    if (!loanData.bankName || !loanData.description || typeof loanData.installmentAmount !== 'number' || loanData.installmentAmount <= 0 || !loanData.startDate || typeof loanData.installmentsCount !== 'number' || loanData.installmentsCount < 1) {
      return NextResponse.json({ success: false, message: 'Missing or invalid required fields for loan.' }, { status: 400 });
    }
     if (isNaN(Date.parse(loanData.startDate))) {
        return NextResponse.json({ success: false, message: 'Invalid start date format.' }, { status: 400 });
    }


    const result: AddLoanResult = await addLoan(userId, loanData);

    if (result.success && result.loanId) {
      return NextResponse.json({ success: true, loanId: result.loanId, message: 'Loan added successfully.' }, { status: 201 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to add loan.' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Add loan API error:', error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ success: false, message: 'Invalid JSON payload.' }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const loans: Loan[] = await getLoansForUser(userId);
    return NextResponse.json({ success: true, loans }, { status: 200 });
  } catch (error: any) {
    console.error('Get loans error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred while fetching loans.' }, { status: 500 });
  }
}
