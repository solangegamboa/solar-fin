
export interface UserProfile {
  id: string; // Changed from uid to id for general DB consistency
  email: string; // Email is now mandatory
  displayName?: string | null;
  photoURL?: string | null; // Keep for potential future use
  createdAt?: number;
  lastLoginAt?: number;
  // hashedPassword should not be part of UserProfile sent to client
}

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  category: string; // This will now reference a UserCategory.name
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
  installmentsCount: number;
  startDate: string; 
  endDate: string;   
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
  category: string; // This will now reference a UserCategory.name
  totalAmount: number;
  installments: number;
  createdAt: number;
}

export interface UserCategory {
  id: string;
  userId: string;
  name: string;
  isSystemDefined: boolean; // To differentiate default from user-added
  createdAt: number;
}

// For AI Flow - this might need adjustment if AI needs password or other auth details (it shouldn't)
export interface FinancialDataInput {
  income: number;
  expenses: Array<{ category: string; amount: number }>;
  loans: Array<{ description: string; amount: number; interestRate: number; monthlyPayment: number }>;
  creditCards: Array<{ name: string; limit: number; balance: number; dueDate: string }>;
}

// Data for creating new entities
export interface NewTransactionData {
  type: TransactionType;
  amount: number;
  category: string; // Will be the category name string
  date: string;
  description?: string;
  isRecurring?: boolean;
  receiptImageUri?: string | null; // Added for new feature
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
  category: string; // Will be the category name string
  totalAmount: number;
  installments: number;
}

export interface NewLoanData {
  bankName: string;
  description: string;
  installmentAmount: number;
  installmentsCount: number;
  startDate: string;
}

export interface NewUserCategoryData {
  name: string;
  isSystemDefined?: boolean;
}


// API response types
export interface AuthApiResponse {
  success: boolean;
  message?: string;
  user?: UserProfile; // For login/signup/me
  token?: string; // Optionally return token if not only using cookies
}

// Genkit Flow for extracting transaction details from image
export interface ExtractTransactionDetailsInput {
  imageDataUri: string;
}

export interface ExtractTransactionDetailsOutput {
  extractedAmount: number | null;
  // could add more fields here in the future e.g. date, merchant
}
