
// src/app/api/credit-card-purchases/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { addCreditCardPurchase, getCreditCardPurchasesForUser } from '@/lib/databaseService';
import type { NewCreditCardPurchaseData, CreditCardPurchase, AddCreditCardPurchaseResult } from '@/types';
import { getUserIdFromAuthHeader } from '@/lib/authUtils';

// Interface for the data expected from the client for POST
interface NewCreditCardPurchaseClientData {
  cardId: string;
  date: string;
  description: string;
  category: string;
  installmentAmount: number; // Client sends installmentAmount
  installments: number;
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const clientData = await req.json() as NewCreditCardPurchaseClientData;

    // Basic validation for client data
    if (!clientData.cardId || !clientData.date || !clientData.description || !clientData.category || typeof clientData.installmentAmount !== 'number' || clientData.installmentAmount <= 0 || typeof clientData.installments !== 'number' || clientData.installments < 1) {
      return NextResponse.json({ success: false, message: 'Missing or invalid required fields for credit card purchase.' }, { status: 400 });
    }

    // Calculate totalAmount
    const totalAmount = parseFloat((clientData.installmentAmount * clientData.installments).toFixed(2));

    // Prepare data for databaseService (which expects totalAmount)
    const purchaseDataForDb: NewCreditCardPurchaseData = {
      cardId: clientData.cardId,
      date: clientData.date,
      description: clientData.description,
      category: clientData.category,
      totalAmount: totalAmount, // Use calculated totalAmount
      installments: clientData.installments,
    };

    const result: AddCreditCardPurchaseResult = await addCreditCardPurchase(userId, purchaseDataForDb);

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
    const purchases: CreditCardPurchase[] = await getCreditCardPurchasesForUser(userId);
    return NextResponse.json({ success: true, purchases }, { status: 200 });
  } catch (error: any) {
    console.error('Get credit card purchases error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
