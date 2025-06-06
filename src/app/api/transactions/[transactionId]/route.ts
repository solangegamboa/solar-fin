
// src/app/api/transactions/[transactionId]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { updateTransaction, deleteTransaction } from '@/lib/databaseService';
import type { UpdateTransactionData, UpdateResult } from '@/types';
import { getUserIdFromAuthHeader } from '@/lib/authUtils';

interface RouteParams {
  params: {
    transactionId: string;
  };
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  const { transactionId } = params;
  if (!transactionId) {
    return NextResponse.json({ success: false, message: 'Transaction ID is required.' }, { status: 400 });
  }

  try {
    const updateData = await req.json() as UpdateTransactionData;
    // Add more specific validation for updateData if needed
    if (updateData.amount !== undefined && updateData.amount <= 0) {
        return NextResponse.json({ success: false, message: 'Amount must be positive.' }, { status: 400 });
    }

    const result: UpdateResult = await updateTransaction(userId, transactionId, updateData);
    if (result.success) {
      return NextResponse.json({ success: true, message: 'Transaction updated successfully.' }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to update transaction.' }, { status: result.error?.includes("not found") ? 404 : 500 });
    }
  } catch (error: any) {
    console.error('Update transaction error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }
  const { transactionId } = params;
  if (!transactionId) {
    return NextResponse.json({ success: false, message: 'Transaction ID is required.' }, { status: 400 });
  }

  try {
    const result: UpdateResult = await deleteTransaction(userId, transactionId);
    if (result.success) {
      return NextResponse.json({ success: true, message: 'Transaction deleted successfully.' }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to delete transaction.' }, { status: result.error?.includes("not found") ? 404 : 500 });
    }
  } catch (error: any) {
    console.error('Delete transaction error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
