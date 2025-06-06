
export interface UserProfile {
  id: string; // Changed from uid to id for general DB consistency
  email: string; // Email is now mandatory
  displayName?: string | null;
  photoURL?: string | null; // Keep for potential future use
  createdAt?: number;
  lastLoginAt?: number;
  notifyByEmail?: boolean; // Added for email notification preference
  // hashedPassword should not be part of UserProfile sent to client
}

export type TransactionType = 'income' | 'expense';
export type RecurrenceFrequency = 'none' | 'monthly' | 'weekly' | 'annually';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  category: string; // This will now reference a UserCategory.name
  date: string; // Original date of the transaction template
  description?: string;
  recurrenceFrequency?: RecurrenceFrequency;
  createdAt: number;
  updatedAt?: number; // Added for consistency
  receiptImageUri?: string | null; 
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
  updatedAt?: number; // Added
}

export interface CreditCard {
  id:string;
  userId: string;
  name: string;
  limit: number;
  dueDateDay: number;
  closingDateDay: number;
  createdAt: number;
  updatedAt?: number; // Added
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
  updatedAt?: number; // Added
}

export interface UserCategory {
  id: string;
  userId: string;
  name: string;
  isSystemDefined: boolean; // To differentiate default from user-added
  createdAt: number;
}

export type FinancialGoalStatus = 'active' | 'achieved' | 'abandoned';

export interface FinancialGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string | null; // ISO string like 'YYYY-MM-DD'
  description?: string | null;
  icon?: string | null; // Lucide icon name
  status: FinancialGoalStatus;
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
}

export type InvestmentType = 'stock' | 'savings' | 'crypto' | 'other';

export interface Investment {
  id: string;
  userId: string;
  name: string;
  type: InvestmentType;
  initialAmount?: number | null;
  currentValue: number;
  quantity?: number | null;
  symbol?: string | null;
  institution?: string | null;
  acquisitionDate?: string | null; // ISO date string 'YYYY-MM-DD'
  notes?: string | null;
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
}


// For AI Flow - this might need adjustment if AI needs password or other auth details (it shouldn't)
export interface FinancialDataInput {
  income: number;
  expenses: Array<{ category: string; amount: number }>;
  loans: Array<{ description: string; amount: number; interestRate: number; monthlyPayment: number }>;
  creditCards: Array<{ name: string; limit: number; balance: number; dueDate: string }>;
  investments?: Array<{ name: string; type: string; currentValue: number; initialAmount?: number | null; symbol?: string | null }>;
}

// Data for creating new entities
export interface NewTransactionData {
  type: TransactionType;
  amount: number;
  category: string; // Will be the category name string
  date: string;
  description?: string;
  recurrenceFrequency?: RecurrenceFrequency;
  receiptImageUri?: string | null; 
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

export interface NewFinancialGoalData {
  name: string;
  targetAmount: number;
  currentAmount?: number; // Defaults to 0
  targetDate?: string | null;
  description?: string | null;
  icon?: string | null;
  status?: FinancialGoalStatus; // Defaults to 'active'
}

export interface UpdateFinancialGoalData {
  name?: string;
  targetAmount?: number;
  currentAmount?: number;
  targetDate?: string | null;
  description?: string | null;
  icon?: string | null;
  status?: FinancialGoalStatus;
}

export interface NewInvestmentData {
  name: string;
  type: InvestmentType;
  initialAmount?: number | null;
  currentValue: number;
  quantity?: number | null;
  symbol?: string | null;
  institution?: string | null;
  acquisitionDate?: string | null;
  notes?: string | null;
}

export interface UpdateInvestmentData {
  name?: string;
  type?: InvestmentType;
  initialAmount?: number | null;
  currentValue?: number;
  quantity?: number | null;
  symbol?: string | null;
  institution?: string | null;
  acquisitionDate?: string | null;
  notes?: string | null;
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

// Genkit Flow for extracting credit card info from image
export interface ExtractCardInfoInput {
  imageDataUri: string;
}

export interface ExtractCardInfoOutput {
  issuerName: string | null;      // e.g., "Nubank", "Bradesco"
  cardNetwork: string | null;     // e.g., "Visa", "Mastercard"
  cardProductName: string | null; // e.g., "Platinum", "Ultravioleta", "Black"
  suggestedCardName: string | null; // A combined suggestion
}

// Backup and Restore types
export interface UserBackupData {
  profile: Pick<UserProfile, 'email' | 'displayName' | 'notifyByEmail'>;
  transactions: Transaction[];
  loans: Loan[];
  creditCards: CreditCard[];
  creditCardPurchases: CreditCardPurchase[];
  categories: UserCategory[];
  financialGoals: FinancialGoal[]; 
  investments: Investment[];
}

export interface UpdateEmailNotificationPrefsData {
    notifyByEmail: boolean;
}

// Notification specific type
export interface NotificationItem {
  id: string; // Unique ID for the notification instance, e.g., `tx-${originalTx.id}-${projectedDate}`
  type: 'scheduled_transaction'; // More specific type
  relatedId: string; // Original transaction ID (from Transaction.id)
  message: string; // Formatted message
  projectedDate: string; // Projected date of the occurrence (ISO string, e.g., "2023-10-27")
  isRead: boolean;
  isPast: boolean; // True if the projected date is in the past relative to today
  originalTransaction: Transaction; // The original recurring transaction template for context
}
