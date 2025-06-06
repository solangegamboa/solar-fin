
// src/app/api/credit-card-purchases/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { addCreditCardPurchase, getCreditCardPurchasesForUser } from '@/lib/databaseService';
import type { NewCreditCardPurchaseData, CreditCardPurchase, AddCreditCardPurchaseResult } from '@/types';
import { getUserIdFromAuthHeader } from '@/lib/authUtils';

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const purchaseData = await req.json() as NewCreditCardPurchaseData;

    // Basic validation
    if (!purchaseData.cardId || !purchaseData.date || !purchaseData.description || !purchaseData.category || typeof purchaseData.totalAmount !== 'number' || purchaseData.totalAmount <= 0 || typeof purchaseData.installments !== 'number' || purchaseData.installments < 1) {
      return NextResponse.json({ success: false, message: 'Missing or invalid required fields for credit card purchase.' }, { status: 400 });
    }

    const result: AddCreditCardPurchaseResult = await addCreditCardPurchase(userId, purchaseData);

    if (result.success && result.purchaseId) {
      return NextResponse.json({ success: true, purchaseId: result.purchaseId, message: 'Credit card purchase added successfully.' }, { status: 201 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to add credit card purchase.' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Add credit card purchase API error:', error);
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
    // Note: This GET route might not be used directly by the form, but could be for other purposes.
    // The form usually POSTs data. The page displaying purchases would use this.
    const purchases: CreditCardPurchase[] = await getCreditCardPurchasesForUser(userId);
    return NextResponse.json({ success: true, purchases }, { status: 200 });
  } catch (error: any) {
    console.error('Get credit card purchases error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
