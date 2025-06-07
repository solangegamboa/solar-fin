
import { NextResponse, type NextRequest } from 'next/server';
import * as databaseService from '@/lib/databaseService'; // Alterado para importação de namespace
import type { UpdateLoanData, UpdateResult } from '@/types';
import { getUserIdFromAuthHeader } from '@/lib/authUtils';

interface RouteParams {
  params: {
    loanId: string;
  };
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  console.log(`[API PUT /api/loans/${params?.loanId}] Handler started. Request URL: ${req.url}`);
  try {
    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      console.error("[API PUT /api/loans/[loanId]] Not authenticated.");
      return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
    }

    if (!params || !params.loanId) {
      console.error("[API PUT /api/loans/[loanId]] Loan ID is missing from params object.");
      return NextResponse.json({ success: false, message: 'Loan ID parameter is required.' }, { status: 400 });
    }
    const { loanId } = params;
    console.log(`[API PUT /api/loans/${loanId}] Authenticated User ID: ${userId}. Processing loan ID: ${loanId}`);

    let updateDataJson;
    try {
      updateDataJson = await req.json();
    } catch (jsonError: any) {
      console.error(`[API PUT /api/loans/${loanId}] Error parsing JSON body:`, jsonError.message);
      return NextResponse.json({ success: false, message: `Invalid JSON payload: ${jsonError.message}` }, { status: 400 });
    }
    
    const updateData = updateDataJson as UpdateLoanData;
    console.log(`[API PUT /api/loans/${loanId}] Received update data:`, JSON.stringify(updateData));

    // Basic validation for update data
    if (updateData.installmentAmount !== undefined && (typeof updateData.installmentAmount !== 'number' || updateData.installmentAmount <= 0)) {
        console.log(`[API PUT /api/loans/${loanId}] Invalid installment amount: ${updateData.installmentAmount}`);
        return NextResponse.json({ success: false, message: 'Installment amount must be a positive number.' }, { status: 400 });
    }
    if (updateData.installmentsCount !== undefined && (typeof updateData.installmentsCount !== 'number' || !Number.isInteger(updateData.installmentsCount) || updateData.installmentsCount < 1)) {
        console.log(`[API PUT /api/loans/${loanId}] Invalid installments count: ${updateData.installmentsCount}`);
        return NextResponse.json({ success: false, message: 'Installments count must be a positive integer.' }, { status: 400 });
    }
    if (updateData.startDate !== undefined) {
        // Check if it's a string and matches YYYY-MM-DD format and is a valid date
        if (typeof updateData.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(updateData.startDate) || isNaN(Date.parse(updateData.startDate))) {
            console.log(`[API PUT /api/loans/${loanId}] Invalid start date format: ${updateData.startDate}`);
            return NextResponse.json({ success: false, message: 'Invalid start date format. Expected YYYY-MM-DD and a valid date.' }, { status: 400 });
        }
    }
    if (updateData.bankName !== undefined && (typeof updateData.bankName !== 'string' || updateData.bankName.trim().length === 0 || updateData.bankName.length > 50 )) {
        console.log(`[API PUT /api/loans/${loanId}] Invalid bank name: ${updateData.bankName}`);
        return NextResponse.json({ success: false, message: 'Invalid bank name.' }, { status: 400 });
    }
     if (updateData.description !== undefined && (typeof updateData.description !== 'string' || updateData.description.trim().length === 0 || updateData.description.length > 100 )) {
        console.log(`[API PUT /api/loans/${loanId}] Invalid description: ${updateData.description}`);
        return NextResponse.json({ success: false, message: 'Invalid description.' }, { status: 400 });
    }
    console.log(`[API PUT /api/loans/${loanId}] Data validated, calling databaseService.updateLoan.`);

    const result = await databaseService.updateLoan(userId, loanId, updateData);
    console.log(`[API PUT /api/loans/${loanId}] databaseService.updateLoan result:`, JSON.stringify(result));

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Loan updated successfully.' }, { status: 200 });
    } else {
      const errorMessage = typeof result.error === 'string' ? result.error : 'Failed to update loan due to an unknown database error.';
      const statusCode = errorMessage.includes("not found") ? 404 : 500;
      console.error(`[API PUT /api/loans/${loanId}] Failed to update loan: ${errorMessage}`);
      return NextResponse.json({ success: false, message: errorMessage }, { status: statusCode });
    }
  } catch (error: any) {
    console.error(`[API PUT /api/loans/[loanId]] CRITICAL UNHANDLED ERROR in handler: ${error.message}`, error.stack);
    return NextResponse.json({ success: false, message: `Critical server error: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  console.log(`[API DELETE /api/loans/${params?.loanId}] Handler started. Request URL: ${req.url}`);
  try {
    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      console.error("[API DELETE /api/loans/[loanId]] Not authenticated.");
      return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
    }

    if (!params || !params.loanId) {
      console.error("[API DELETE /api/loans/[loanId]] Loan ID is missing from params object.");
      return NextResponse.json({ success: false, message: 'Loan ID parameter is required.' }, { status: 400 });
    }
    const { loanId } = params;
    console.log(`[API DELETE /api/loans/${loanId}] Authenticated User ID: ${userId}. Processing loan ID: ${loanId}`);
    
    const result: UpdateResult = await databaseService.deleteLoan(userId, loanId);
    console.log(`[API DELETE /api/loans/${loanId}] databaseService.deleteLoan result:`, JSON.stringify(result));

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Loan deleted successfully.' }, { status: 200 });
    } else {
      const errorMessage = typeof result.error === 'string' ? result.error : 'Failed to delete loan due to an unknown database error.';
      const statusCode = errorMessage.includes("not found") ? 404 : 500;
      console.error(`[API DELETE /api/loans/${loanId}] Failed to delete loan: ${errorMessage}`);
      return NextResponse.json({ success: false, message: errorMessage }, { status: statusCode });
    }
  } catch (error: any) {
    console.error(`[API DELETE /api/loans/[loanId]] CRITICAL UNHANDLED ERROR in handler: ${error.message}`, error.stack);
    return NextResponse.json({ success: false, message: `Critical server error: ${error.message}` }, { status: 500 });
  }
}
