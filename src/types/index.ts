
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
  isRecurring?: boolean; 
  createdAt: number; 
}

export interface Loan {
  id: string;
  userId: string;
  bankName: string;
  description: string;
  installmentAmount: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
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
  date: string; 
  description: string;
  category: string;
  totalAmount: number; 
  installments: number; 
  createdAt: number;
}

export interface FinancialDataInput {
  income: number;
  expenses: Array<{ category: string; amount: number }>;
  loans: Array<{ description: string; amount: number; interestRate: number; monthlyPayment: number }>; // This might need adjustment if AI uses it
  creditCards: Array<{ name: string; limit: number; balance: number; dueDate: string }>;
}

export interface NewTransactionData {
  type: TransactionType;
  amount: number;
  category: string;
  date: string; 
  description?: string;
  isRecurring?: boolean;
}

export interface NewCreditCardData {
  name: string;
  limit: number;
  dueDateDay: number;
  closingDateDay: number;
}

export interface NewCreditCardPurchaseData {
  cardId: string;
  date: string; 
  description: string;
  category: string;
  totalAmount: number;
  installments: number;
}

export interface NewLoanData {
  bankName: string;
  description: string;
  installmentAmount: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}
