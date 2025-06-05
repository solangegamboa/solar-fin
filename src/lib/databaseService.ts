
'use server';

import fs from 'fs/promises';
import path from 'path';
import type { UserProfile, Transaction, NewTransactionData, FinancialDataInput, CreditCard, NewCreditCardData, CreditCardPurchase, NewCreditCardPurchaseData, Loan, NewLoanData } from '@/types';
import { randomUUID } from 'crypto';
import { parseISO, isWithinInterval, startOfMonth, endOfMonth, addMonths, format as formatDateFns } from 'date-fns';


const DB_PATH = path.join(process.cwd(), 'src', 'data', 'db.json');
const DEFAULT_USER_ID = 'default_user'; 

interface LocalDB {
  users: {
    [uid: string]: {
      profile: UserProfile;
      transactions: Transaction[];
      loans: Loan[]; 
      creditCards?: CreditCard[];
      creditCardPurchases?: CreditCardPurchase[];
    };
  };
}

async function readDB(): Promise<LocalDB> {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(data) as LocalDB;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      const initialDb: LocalDB = {
        users: {
          [DEFAULT_USER_ID]: {
            profile: {
              uid: DEFAULT_USER_ID,
              email: 'user@example.local',
              displayName: 'Local User',
              photoURL: null,
              createdAt: Date.now(),
              lastLoginAt: Date.now(),
            },
            transactions: [],
            loans: [],
            creditCards: [],
            creditCardPurchases: [],
          },
        },
      };
      await writeDB(initialDb);
      console.log('Created db.json with default user structure including loans, creditCardPurchases.');
      return initialDb;
    }
    console.error('Error reading database file:', error.message, error);
    throw new Error('Could not read database.');
  }
}

async function writeDB(data: LocalDB): Promise<void> {
  try {
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error: any) {
    console.error('Error writing to database file:', error.message, error);
    throw new Error('Could not write to database.');
  }
}

async function ensureDefaultUserStructure(db: LocalDB): Promise<LocalDB> {
  if (!db.users[DEFAULT_USER_ID]) {
    db.users[DEFAULT_USER_ID] = {
      profile: {
        uid: DEFAULT_USER_ID,
        email: 'user@example.local',
        displayName: 'Local User',
        photoURL: null,
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      },
      transactions: [],
      loans: [],
      creditCards: [],
      creditCardPurchases: [],
    };
    console.log(`Default user structure created in local DB for ${DEFAULT_USER_ID}.`);
  } else {
    if (!db.users[DEFAULT_USER_ID].transactions) db.users[DEFAULT_USER_ID].transactions = [];
    if (!db.users[DEFAULT_USER_ID].loans) db.users[DEFAULT_USER_ID].loans = [];
    if (!db.users[DEFAULT_USER_ID].creditCards) db.users[DEFAULT_USER_ID].creditCards = [];
    if (!db.users[DEFAULT_USER_ID].creditCardPurchases) db.users[DEFAULT_USER_ID].creditCardPurchases = [];
  }
  return db;
}

export const upsertUser = async (): Promise<void> => {
  let db = await readDB();
  db = await ensureDefaultUserStructure(db);
  if (db.users[DEFAULT_USER_ID]) {
    db.users[DEFAULT_USER_ID].profile.lastLoginAt = Date.now();
  }
  await writeDB(db);
  console.log(`Checked/Updated default user profile in local DB.`);
};


export interface AddTransactionResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export const addTransaction = async (transactionData: NewTransactionData): Promise<AddTransactionResult> => {
  try {
    let db = await readDB();
    db = await ensureDefaultUserStructure(db);

    const newTransaction: Transaction = {
      id: randomUUID(),
      userId: DEFAULT_USER_ID, 
      ...transactionData,
      isRecurring: transactionData.isRecurring || false,
      createdAt: Date.now(),
    };

    db.users[DEFAULT_USER_ID].transactions.push(newTransaction);
    await writeDB(db);

    console.log(`Transaction ${newTransaction.id} added for default user in local DB.`);
    return { success: true, transactionId: newTransaction.id };
  } catch (error: any) {
    const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
    console.error("Error adding transaction to local DB:", errorMessage, error);
    return { success: false, error: "An error occurred while adding the transaction." };
  }
};

export async function getTransactionsForUser(): Promise<Transaction[]> {
  try {
    let db = await readDB();
    db = await ensureDefaultUserStructure(db);
    const transactions = db.users[DEFAULT_USER_ID]?.transactions || [];
    return transactions.sort((a, b) => {
      const dateComparison = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateComparison !== 0) {
        return dateComparison;
      }
      return b.createdAt - a.createdAt;
    });
  } catch (error: any) {
    const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
    console.error(`Error fetching transactions for default user from local DB:`, errorMessage, error);
    return []; 
  }
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

export const deleteTransaction = async (transactionId: string): Promise<DeleteResult> => {
  try {
    let db = await readDB();
    db = await ensureDefaultUserStructure(db);

    const initialLength = db.users[DEFAULT_USER_ID].transactions.length;
    db.users[DEFAULT_USER_ID].transactions = db.users[DEFAULT_USER_ID].transactions.filter(
      (tx) => tx.id !== transactionId
    );

    if (db.users[DEFAULT_USER_ID].transactions.length === initialLength) {
      console.log(`Transaction ${transactionId} not found for default user.`);
      return { success: false, error: "Transaction not found." };
    }

    await writeDB(db);
    console.log(`Transaction ${transactionId} deleted for default user in local DB.`);
    return { success: true };
  } catch (error: any) {
    const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
    console.error("Error deleting transaction from local DB:", errorMessage, error);
    return { success: false, error: "An error occurred while deleting the transaction." };
  }
};

export async function getFinancialDataForUser(): Promise<FinancialDataInput | null> {
  try {
    let db = await readDB();
    db = await ensureDefaultUserStructure(db);

    const userData = db.users[DEFAULT_USER_ID];

    if (!userData) {
      console.log(`Default user ${DEFAULT_USER_ID} not found in local DB for financial data.`);
      return null;
    }

    const expensesByCategory: { [category: string]: number } = {};
    let totalIncomeThisMonth = 0; 

    (userData.transactions || []).forEach(tx => {
      if (tx.type === 'expense') {
        expensesByCategory[tx.category] = (expensesByCategory[tx.category] || 0) + tx.amount;
      } else if (tx.type === 'income') {
        totalIncomeThisMonth += tx.amount;
      }
    });

    const expensesArray = Object.entries(expensesByCategory).map(([category, amount]) => ({
      category,
      amount,
    }));

    const incomeForAI = totalIncomeThisMonth > 0 ? totalIncomeThisMonth : 5000; 

    const loansForAI = (userData.loans || []).map(loan => ({
      description: `${loan.bankName} - ${loan.description}`,
      amount: loan.installmentAmount * loan.installmentsCount, // Using installmentsCount
      interestRate: 0, 
      monthlyPayment: loan.installmentAmount,
    }));


    return {
      income: incomeForAI, 
      expenses: expensesArray,
      loans: loansForAI,
      creditCards: (userData.creditCards || []).map(cc => ({
        name: cc.name,
        limit: cc.limit,
        balance: 0, 
        dueDate: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(cc.dueDateDay).padStart(2, '0')}`
      })),
    };

  } catch (error: any) {
    const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
    console.error(`Error fetching financial data for default user from local DB:`, errorMessage, error);
    return null;
  }
}

// Credit Card Specific Functions
export interface AddCreditCardResult {
  success: boolean;
  creditCardId?: string;
  error?: string;
}

export const addCreditCard = async (creditCardData: NewCreditCardData): Promise<AddCreditCardResult> => {
  try {
    let db = await readDB();
    db = await ensureDefaultUserStructure(db);

    const newCreditCard: CreditCard = {
      id: randomUUID(),
      userId: DEFAULT_USER_ID,
      ...creditCardData,
      limit: Number(creditCardData.limit), 
      dueDateDay: Number(creditCardData.dueDateDay),
      closingDateDay: Number(creditCardData.closingDateDay),
      createdAt: Date.now(),
    };

    if (!db.users[DEFAULT_USER_ID].creditCards) {
      db.users[DEFAULT_USER_ID].creditCards = [];
    }
    db.users[DEFAULT_USER_ID].creditCards!.push(newCreditCard);
    await writeDB(db);

    console.log(`Credit Card ${newCreditCard.id} added for default user in local DB.`);
    return { success: true, creditCardId: newCreditCard.id };
  } catch (error: any) {
    const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
    console.error("Error adding credit card to local DB:", errorMessage, error);
    return { success: false, error: "An error occurred while adding the credit card." };
  }
};

export async function getCreditCardsForUser(): Promise<CreditCard[]> {
  try {
    let db = await readDB();
    db = await ensureDefaultUserStructure(db);
    const creditCards = db.users[DEFAULT_USER_ID]?.creditCards || [];
    return creditCards.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error: any) {
    const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
    console.error(`Error fetching credit cards for default user from local DB:`, errorMessage, error);
    return [];
  }
}


export interface AddCreditCardPurchaseResult {
  success: boolean;
  purchaseId?: string;
  error?: string;
}

export const addCreditCardPurchase = async (purchaseData: NewCreditCardPurchaseData): Promise<AddCreditCardPurchaseResult> => {
  try {
    let db = await readDB();
    db = await ensureDefaultUserStructure(db);

    const newPurchase: CreditCardPurchase = {
      id: randomUUID(),
      userId: DEFAULT_USER_ID,
      ...purchaseData,
      totalAmount: Number(purchaseData.totalAmount),
      installments: Number(purchaseData.installments),
      createdAt: Date.now(),
    };

    if (!db.users[DEFAULT_USER_ID].creditCardPurchases) {
      db.users[DEFAULT_USER_ID].creditCardPurchases = [];
    }
    db.users[DEFAULT_USER_ID].creditCardPurchases!.push(newPurchase);
    await writeDB(db);

    console.log(`Credit Card Purchase ${newPurchase.id} added for default user.`);
    return { success: true, purchaseId: newPurchase.id };
  } catch (error: any) {
    const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
    console.error("Error adding credit card purchase to local DB:", errorMessage, error);
    return { success: false, error: "An error occurred while adding the credit card purchase." };
  }
};

export async function getCreditCardPurchasesForUser(): Promise<CreditCardPurchase[]> {
  try {
    let db = await readDB();
    db = await ensureDefaultUserStructure(db);
    const purchases = db.users[DEFAULT_USER_ID]?.creditCardPurchases || [];
    return purchases.sort((a, b) => {
      const dateComparison = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateComparison !== 0) {
        return dateComparison;
      }
      return b.createdAt - a.createdAt;
    });
  } catch (error: any) {
    const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
    console.error(`Error fetching credit card purchases for default user from local DB:`, errorMessage, error);
    return [];
  }
}

export const deleteCreditCardPurchase = async (purchaseId: string): Promise<DeleteResult> => {
  try {
    let db = await readDB();
    db = await ensureDefaultUserStructure(db);

    const purchasesArray = db.users[DEFAULT_USER_ID].creditCardPurchases || [];
    const initialLength = purchasesArray.length;
    db.users[DEFAULT_USER_ID].creditCardPurchases = purchasesArray.filter(
      (p) => p.id !== purchaseId
    );

    if (db.users[DEFAULT_USER_ID].creditCardPurchases!.length === initialLength) {
      console.log(`Credit Card Purchase ${purchaseId} not found for default user.`);
      return { success: false, error: "Credit card purchase not found." };
    }

    await writeDB(db);
    console.log(`Credit Card Purchase ${purchaseId} deleted for default user in local DB.`);
    return { success: true };
  } catch (error: any) {
    const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
    console.error("Error deleting credit card purchase from local DB:", errorMessage, error);
    return { success: false, error: "An error occurred while deleting the credit card purchase." };
  }
};

// Loan Specific Functions
export interface AddLoanResult {
  success: boolean;
  loanId?: string;
  error?: string;
}

export const addLoan = async (loanData: NewLoanData): Promise<AddLoanResult> => {
  try {
    let db = await readDB();
    db = await ensureDefaultUserStructure(db);

    const startDateObj = parseISO(loanData.startDate);
    // Subtract 1 from installmentsCount because addMonths is 0-indexed for the number of months to add
    // e.g., adding 0 months to Jan 15 gives Jan 15 (1st installment)
    // adding 11 months to Jan 15 for a 12-installment loan gives Dec 15 (12th installment)
    const endDateObj = addMonths(startDateObj, loanData.installmentsCount -1); 
    const calculatedEndDate = formatDateFns(endDateObj, 'yyyy-MM-dd');

    const newLoan: Loan = {
      id: randomUUID(),
      userId: DEFAULT_USER_ID,
      bankName: loanData.bankName,
      description: loanData.description,
      installmentAmount: Number(loanData.installmentAmount),
      installmentsCount: Number(loanData.installmentsCount),
      startDate: loanData.startDate,
      endDate: calculatedEndDate, // Store the calculated end date
      createdAt: Date.now(),
    };

    if (!db.users[DEFAULT_USER_ID].loans) {
      db.users[DEFAULT_USER_ID].loans = [];
    }
    db.users[DEFAULT_USER_ID].loans.push(newLoan);
    await writeDB(db);

    console.log(`Loan ${newLoan.id} added for default user in local DB. End date: ${calculatedEndDate}`);
    return { success: true, loanId: newLoan.id };
  } catch (error: any) {
    const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
    console.error("Error adding loan to local DB:", errorMessage, error);
    return { success: false, error: "An error occurred while adding the loan." };
  }
};

export async function getLoansForUser(): Promise<Loan[]> {
  try {
    let db = await readDB();
    db = await ensureDefaultUserStructure(db);
    const loans = db.users[DEFAULT_USER_ID]?.loans || [];
    return loans.sort((a, b) => {
      const startDateComparison = parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime();
      if (startDateComparison !== 0) {
        return startDateComparison;
      }
      return b.createdAt - a.createdAt;
    });
  } catch (error: any) {
    const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
    console.error(`Error fetching loans for default user from local DB:`, errorMessage, error);
    return [];
  }
}

export const deleteLoan = async (loanId: string): Promise<DeleteResult> => {
  try {
    let db = await readDB();
    db = await ensureDefaultUserStructure(db);

    const loansArray = db.users[DEFAULT_USER_ID].loans || [];
    const initialLength = loansArray.length;
    db.users[DEFAULT_USER_ID].loans = loansArray.filter(
      (l) => l.id !== loanId
    );

    if (db.users[DEFAULT_USER_ID].loans!.length === initialLength) {
      console.log(`Loan ${loanId} not found for default user.`);
      return { success: false, error: "Loan not found." };
    }

    await writeDB(db);
    console.log(`Loan ${loanId} deleted for default user in local DB.`);
    return { success: true };
  } catch (error: any) {
    const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
    console.error("Error deleting loan from local DB:", errorMessage, error);
    return { success: false, error: "An error occurred while deleting the loan." };
  }
};

