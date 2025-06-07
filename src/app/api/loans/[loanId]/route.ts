
import { NextResponse, type NextRequest } from 'next/server';
import * as databaseService from '@/lib/databaseService';
import type { UpdateLoanData, UpdateResult } from '@/types';
import { getUserIdFromAuthHeader } from '@/lib/authUtils';

interface RouteParams {
  params: {
    loanId: string;
  };
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const handlerName = `[API PUT /api/loans/${params?.loanId || 'undefined_loanId'}]`;
  console.log(`${handlerName} Handler started. Request URL: ${req.url}`);

  try { 
    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      console.error(`${handlerName} Not authenticated.`);
      return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
    }

    if (!params || !params.loanId) {
      console.error(`${handlerName} Loan ID is missing from params object.`);
      return NextResponse.json({ success: false, message: 'Loan ID parameter is required.' }, { status: 400 });
    }
    const { loanId } = params;
    console.log(`${handlerName} Authenticated User ID: ${userId}. Processing loan ID: ${loanId}`);

    let updateData: UpdateLoanData;
    try {
      const rawBody = await req.json();
      updateData = rawBody as UpdateLoanData; 
      console.log(`${handlerName} Received update data:`, JSON.stringify(updateData));
    } catch (jsonError: any) {
      console.error(`${handlerName} Error parsing JSON body:`, jsonError.message, jsonError.stack);
      return NextResponse.json({ success: false, message: `Invalid JSON payload: ${jsonError.message}` }, { status: 400 });
    }
    
    // Minimal server-side validation moved to databaseService or handled by client-side Zod

    console.log(`${handlerName} Calling databaseService.updateLoan with data:`, updateData);
    const result = await databaseService.updateLoan(userId, loanId, updateData);
    console.log(`${handlerName} databaseService.updateLoan result:`, JSON.stringify(result));

    if (result.success) {
      console.log(`${handlerName} Loan updated successfully.`);
      return NextResponse.json({ success: true, message: 'Loan updated successfully.' }, { status: 200 });
    } else {
      const errorMessage = result.error || 'Failed to update loan due to an unknown database error.';
      const statusCode = errorMessage.includes("not found") ? 404 : 
                         errorMessage.includes("not configured correctly") ? 503 :
                         500;
      console.error(`${handlerName} Failed to update loan: ${errorMessage}`);
      return NextResponse.json({ success: false, message: errorMessage }, { status: statusCode });
    }
  } catch (error: any) { 
    const errorMsg = error.message || 'An unexpected server error occurred during PUT operation.';
    const errorStack = error.stack || 'No stack trace available for PUT operation.';
    console.error(`${handlerName} CRITICAL UNHANDLED ERROR in handler: ${errorMsg}`, errorStack, error);
    return NextResponse.json({ success: false, message: `Server Error: ${errorMsg}` }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const handlerName = `[API DELETE /api/loans/${params?.loanId || 'undefined_loanId'}]`;
  console.log(`${handlerName} Handler started. Request URL: ${req.url}`);
  try {
    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      console.error(`${handlerName} Not authenticated.`);
      return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
    }

    if (!params || !params.loanId) {
      console.error(`${handlerName} Loan ID is missing from params object.`);
      return NextResponse.json({ success: false, message: 'Loan ID parameter is required.' }, { status: 400 });
    }
    const { loanId } = params;
    console.log(`${handlerName} Authenticated User ID: ${userId}. Processing loan ID: ${loanId}`);
    
    const result: UpdateResult = await databaseService.deleteLoan(userId, loanId);
    console.log(`${handlerName} databaseService.deleteLoan result:`, JSON.stringify(result));

    if (result.success) {
      console.log(`${handlerName} Loan deleted successfully.`);
      return NextResponse.json({ success: true, message: 'Loan deleted successfully.' }, { status: 200 });
    } else {
      const errorMessage = result.error || 'Failed to delete loan due to an unknown database error.';
      const statusCode = errorMessage.includes("not found") ? 404 : 
                         errorMessage.includes("not configured correctly") ? 503 :
                         500;
      console.error(`${handlerName} Failed to delete loan: ${errorMessage}`);
      return NextResponse.json({ success: false, message: errorMessage }, { status: statusCode });
    }
  } catch (error: any) {
    const errorMsg = error.message || 'An unexpected server error occurred during DELETE operation.';
    const errorStack = error.stack || 'No stack trace available for DELETE operation.';
    console.error(`${handlerName} CRITICAL UNHANDLED ERROR in handler: ${errorMsg}`, errorStack, error);
    return NextResponse.json({ success: false, message: `Server Error: ${errorMsg}` }, { status: 500 });
  }
}
