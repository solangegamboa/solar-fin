
import { NextResponse, type NextRequest } from 'next/server';
import { updateLoan } from '@/lib/databaseService';
import type { UpdateLoanData } from '@/types';
import { getUserIdFromAuthHeader } from '@/lib/authUtils';

interface RouteParams {
  params: {
    loanId: string;
  };
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }
  const { loanId } = params;
  if (!loanId) {
    return NextResponse.json({ success: false, message: 'Loan ID is required.' }, { status: 400 });
  }

  try {
    const updateData = await req.json() as UpdateLoanData;
    
    // Basic validation for update data
    if (updateData.installmentAmount !== undefined && (typeof updateData.installmentAmount !== 'number' || updateData.installmentAmount <= 0)) {
        return NextResponse.json({ success: false, message: 'Installment amount must be a positive number.' }, { status: 400 });
    }
    if (updateData.installmentsCount !== undefined && (typeof updateData.installmentsCount !== 'number' || !Number.isInteger(updateData.installmentsCount) || updateData.installmentsCount < 1)) {
        return NextResponse.json({ success: false, message: 'Installments count must be a positive integer.' }, { status: 400 });
    }
    if (updateData.startDate !== undefined && isNaN(Date.parse(updateData.startDate))) {
        return NextResponse.json({ success: false, message: 'Invalid start date format.' }, { status: 400 });
    }
    if (updateData.bankName !== undefined && (typeof updateData.bankName !== 'string' || updateData.bankName.trim().length === 0 || updateData.bankName.length > 50 )) {
        return NextResponse.json({ success: false, message: 'Invalid bank name.' }, { status: 400 });
    }
     if (updateData.description !== undefined && (typeof updateData.description !== 'string' || updateData.description.trim().length === 0 || updateData.description.length > 100 )) {
        return NextResponse.json({ success: false, message: 'Invalid description.' }, { status: 400 });
    }


    const result = await updateLoan(userId, loanId, updateData);
    if (result.success) {
      return NextResponse.json({ success: true, message: 'Loan updated successfully.' }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to update loan.' }, { status: result.error?.includes("not found") ? 404 : 500 });
    }
  } catch (error: any) {
    console.error('Update loan error:', error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ success: false, message: 'Invalid JSON payload.' }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}

// DELETE already exists and should be fine
export { DELETE } from '@/app/api/loans/[loanId]/route'; // Assuming DELETE logic is in a separate file or can be co-located

