
import { NextResponse, type NextRequest } from 'next/server';
import { updateCreditCardPurchase, deleteCreditCardPurchase, getCreditCardPurchasesForUser } from '@/lib/databaseService'; // Assuming getCreditCardPurchaseById might be needed, or adapt getCreditCardPurchasesForUser
import type { UpdateCreditCardPurchaseData, UpdateResult, CreditCardPurchase } from '@/types';
import { getUserIdFromAuthHeader } from '@/lib/authUtils';

interface RouteParams {
  params: {
    purchaseId: string;
  };
}

// Interface for data expected from client for PUT
interface UpdateCreditCardPurchaseClientData {
    cardId?: string;
    date?: string;
    description?: string;
    category?: string;
    installmentAmount?: number; // Client sends installmentAmount
    installments?: number;
}


export async function PUT(req: NextRequest, { params }: RouteParams) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }
  const { purchaseId } = params;
  if (!purchaseId) {
    return NextResponse.json({ success: false, message: 'Purchase ID is required.' }, { status: 400 });
  }

  try {
    const clientUpdateData = await req.json() as UpdateCreditCardPurchaseClientData;
    
    // Prepare data for databaseService, which expects totalAmount
    const dataForDb: Partial<UpdateCreditCardPurchaseData> = {
        cardId: clientUpdateData.cardId,
        date: clientUpdateData.date,
        description: clientUpdateData.description,
        category: clientUpdateData.category,
        // totalAmount will be calculated if installmentAmount or installments are provided
        installments: clientUpdateData.installments,
    };

    // If installmentAmount or installments are changing, recalculate totalAmount
    if (clientUpdateData.installmentAmount !== undefined || clientUpdateData.installments !== undefined) {
        // To correctly recalculate, we need the existing purchase data if not all parts are provided
        const allPurchases = await getCreditCardPurchasesForUser(userId); // Fetch all and find
        const existingPurchase = allPurchases.find(p => p.id === purchaseId);

        if (!existingPurchase) {
            return NextResponse.json({ success: false, message: 'Purchase not found for update.' }, { status: 404 });
        }

        const newInstallmentAmount = clientUpdateData.installmentAmount !== undefined 
            ? clientUpdateData.installmentAmount 
            : (existingPurchase.totalAmount / existingPurchase.installments);
        
        const newInstallments = clientUpdateData.installments !== undefined 
            ? clientUpdateData.installments 
            : existingPurchase.installments;

        if (newInstallmentAmount <= 0) {
            return NextResponse.json({ success: false, message: 'Installment amount must be positive.' }, { status: 400 });
        }
        if (newInstallments <= 0 || !Number.isInteger(newInstallments)) {
            return NextResponse.json({ success: false, message: 'Installments must be a positive integer.' }, { status: 400 });
        }
        
        dataForDb.totalAmount = parseFloat((newInstallmentAmount * newInstallments).toFixed(2));
        dataForDb.installments = newInstallments; // Ensure installments is set for DB
    }


    // Basic validation for other fields (if any)
    if (dataForDb.totalAmount !== undefined && dataForDb.totalAmount <= 0 && (clientUpdateData.installmentAmount === undefined && clientUpdateData.installments === undefined) ) {
        // This case should not happen if totalAmount is only derived from installmentAmount/installments
        // but as a safeguard if totalAmount was directly editable (which it is not anymore from form)
        return NextResponse.json({ success: false, message: 'Total amount must be positive.' }, { status: 400 });
    }
     if (dataForDb.installments !== undefined && (dataForDb.installments <= 0 || !Number.isInteger(dataForDb.installments))) {
        return NextResponse.json({ success: false, message: 'Installments must be a positive integer.' }, { status: 400 });
    }


    const result: UpdateResult = await updateCreditCardPurchase(userId, purchaseId, dataForDb);
    if (result.success) {
      return NextResponse.json({ success: true, message: 'Credit card purchase updated successfully.' }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to update credit card purchase.' }, { status: result.error?.includes("not found") ? 404 : 500 });
    }
  } catch (error: any) {
    console.error('Update credit card purchase error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
  }
  const { purchaseId } = params;
  if (!purchaseId) {
    return NextResponse.json({ success: false, message: 'Purchase ID is required.' }, { status: 400 });
  }

  try {
    const result: UpdateResult = await deleteCreditCardPurchase(userId, purchaseId);
    if (result.success) {
      return NextResponse.json({ success: true, message: 'Credit card purchase deleted successfully.' }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: result.error || 'Failed to delete credit card purchase.' }, { status: result.error?.includes("not found") ? 404 : 500 });
    }
  } catch (error: any) {
    console.error('Delete credit card purchase error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
