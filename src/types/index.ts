
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt?: number; 
  lastLoginAt?: number; 
}

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  userId: string; 
  type: TransactionType;
  amount: number;
  category: string;
  date: string; 
  description?: string;
  createdAt: number; 
}

export interface Loan {
  id: string;
  userId: string;
  name: string;
  totalAmount: number;
  interestRate: number; 
  installments: number; 
  paidAmount: number;
  remainingAmount: number;
  monthlyPayment: number;
  startDate: string; 
  endDate?: string; 
  createdAt: number; 
}

export interface CreditCard {
  id:string;
  userId: string;
  name: string;
  limit: number;
  dueDateDay: number; 
  closingDateDay: number; 
  createdAt: number; 
}

export interface CreditCardPurchase {
  id: string;
  userId: string;
  cardId: string;
  description: string;
  totalAmount: number;
  installments: number; 
  currentInstallment: number; 
  purchaseDate: string; 
  firstPaymentDate: string; 
  createdAt: number; 
}

export interface FinancialDataInput {
  income: number;
  expenses: Array<{ category: string; amount: number }>;
  loans: Array<{ description: string; amount: number; interestRate: number; monthlyPayment: number }>;
  creditCards: Array<{ name: string; limit: number; balance: number; dueDate: string }>;
}

// New type for data submitted from the form
export interface NewTransactionData {
  type: TransactionType;
  amount: number;
  category: string;
  date: string; // ISO string e.g., "2024-07-15"
  description?: string;
}

export interface NewCreditCardData {
  name: string;
  limit: number;
  dueDateDay: number;
  closingDateDay: number;
}
