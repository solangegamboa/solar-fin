
import { NextResponse, type NextRequest } from 'next/server';
import { updateCreditCard, deleteCreditCard } from '@/lib/databaseService';
import type { UpdateCreditCardData, UpdateResult } from '@/types';
import { getUserIdFromAuthHeader } from '@/lib/authUtils';

interface RouteParams {
  params: {
    cardId: string;
  };
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }
  const { cardId } = params;
  if (!cardId) {
    return NextResponse.json({ success: false, message: 'Card ID is required.' }, { status: 400 });
  }

  try {
    const updateData = await req.json() as UpdateCreditCardData;
    
    // Basic validation for update data
    if (updateData.name !== undefined) {
        if (typeof updateData.name !== 'string' || updateData.name.trim().length === 0 || updateData.name.length > 50) {
            return NextResponse.json({ success: false, message: 'Invalid card name: must be a non-empty string up to 50 chars.' }, { status: 400 });
        }
    }
    if (updateData.limit !== undefined) {
        if (typeof updateData.limit !== 'number' || isNaN(updateData.limit) || updateData.limit <= 0) {
            return NextResponse.json({ success: false, message: 'Limit must be a positive number.' }, { status: 400 });
        }
    }
    if (updateData.dueDateDay !== undefined) {
        if (typeof updateData.dueDateDay !== 'number' || isNaN(updateData.dueDateDay) || !Number.isInteger(updateData.dueDateDay) || updateData.dueDateDay < 1 || updateData.dueDateDay > 31) {
            return NextResponse.json({ success: false, message: 'Due date day must be an integer between 1 and 31.' }, { status: 400 });
        }
    }
    if (updateData.closingDateDay !== undefined) {
        if (typeof updateData.closingDateDay !== 'number' || isNaN(updateData.closingDateDay) || !Number.isInteger(updateData.closingDateDay) || updateData.closingDateDay < 1 || updateData.closingDateDay > 31) {
            return NextResponse.json({ success: false, message: 'Closing date day must be an integer between 1 and 31.' }, { status: 400 });
        }
    }


    const result: UpdateResult = await updateCreditCard(userId, cardId, updateData);
    if (result.success) {
      return NextResponse.json({ success: true, message: 'Credit card updated successfully.' }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to update credit card.' }, { status: result.error?.includes("not found") ? 404 : 500 });
    }
  } catch (error: any) {
    console.error('Update credit card error:', error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ success: false, message: 'Invalid JSON payload.' }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }
  const { cardId } = params;
  if (!cardId) {
    return NextResponse.json({ success: false, message: 'Card ID is required.' }, { status: 400 });
  }

  try {
    const result: UpdateResult = await deleteCreditCard(userId, cardId);
    if (result.success) {
      return NextResponse.json({ success: true, message: 'Credit card deleted successfully.' }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to delete credit card.' }, { status: result.error?.includes("not found") ? 404 : 500 });
    }
  } catch (error: any) {
    console.error('Delete credit card error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
