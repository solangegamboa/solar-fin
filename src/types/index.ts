export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  // Add other profile fields as needed
}

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: string; // ISO string e.g., "2024-07-15"
  description?: string;
  createdAt: number; // timestamp
}

export interface Loan {
  id: string;
  userId: string;
  name: string;
  totalAmount: number;
  interestRate: number; // Annual percentage
  installments: number; // Total number of installments
  paidAmount: number;
  remainingAmount: number;
  monthlyPayment: number;
  startDate: string; // ISO string
  endDate?: string; // ISO string
  createdAt: number; // timestamp
}

export interface CreditCard {
  id:string;
  userId: string;
  name: string;
  limit: number;
  dueDateDay: number; // Day of the month (1-31)
  closingDateDay: number; // Day of the month (1-31)
  createdAt: number; // timestamp
}

export interface CreditCardPurchase {
  id: string;
  userId: string;
  cardId: string;
  description: string;
  totalAmount: number;
  installments: number; // Total number of installments (1 for single payment)
  currentInstallment: number; // For recurring purchases, otherwise 1
  purchaseDate: string; // ISO string
  firstPaymentDate: string; // ISO string
  createdAt: number; // timestamp
}
