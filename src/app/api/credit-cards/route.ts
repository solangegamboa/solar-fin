
// src/app/api/credit-cards/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { addCreditCard, getCreditCardsForUser } from '@/lib/databaseService';
import type { NewCreditCardData, CreditCard, AddCreditCardResult } from '@/types';
import { getUserIdFromAuthHeader } from '@/lib/authUtils';

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const cardData = await req.json() as NewCreditCardData;

    // Basic validation
    if (!cardData.name || cardData.name.trim().length === 0 || cardData.name.length > 50) {
        return NextResponse.json({ success: false, message: 'Invalid card name.' }, { status: 400 });
    }
    if (typeof cardData.limit !== 'number' || cardData.limit <= 0) {
        return NextResponse.json({ success: false, message: 'Limit must be a positive number.' }, { status: 400 });
    }
    if (typeof cardData.dueDateDay !== 'number' || cardData.dueDateDay < 1 || cardData.dueDateDay > 31) {
        return NextResponse.json({ success: false, message: 'Due date day must be between 1 and 31.' }, { status: 400 });
    }
    if (typeof cardData.closingDateDay !== 'number' || cardData.closingDateDay < 1 || cardData.closingDateDay > 31) {
        return NextResponse.json({ success: false, message: 'Closing date day must be between 1 and 31.' }, { status: 400 });
    }


    const result: AddCreditCardResult = await addCreditCard(userId, cardData);

    if (result.success && result.creditCardId) {
      return NextResponse.json({ success: true, creditCardId: result.creditCardId, message: 'Credit card added successfully.' }, { status: 201 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to add credit card.' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Add credit card API error:', error);
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
    const cards: CreditCard[] = await getCreditCardsForUser(userId);
    return NextResponse.json({ success: true, cards }, { status: 200 });
  } catch (error: any) {
    console.error('Get credit cards error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
