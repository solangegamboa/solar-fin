
'use server';

import fs from 'fs/promises';
import path from 'path';
import type { UserProfile, Transaction, NewTransactionData, FinancialDataInput, CreditCard, NewCreditCardData, CreditCardPurchase, NewCreditCardPurchaseData, Loan, NewLoanData } from '@/types';
import { randomUUID } from 'crypto';
import { parseISO, isWithinInterval, startOfMonth, endOfMonth, addMonths, format as formatDateFns } from 'date-fns';
import { Pool, type QueryResult } from 'pg';

const DB_PATH = path.join(process.cwd(), 'src', 'data', 'db.json');
const DEFAULT_USER_ID = 'default_user'; 

// --- PostgreSQL Schemas (Conceptual) ---
// CREATE TABLE users (
//   uid TEXT PRIMARY KEY,
//   email TEXT UNIQUE,
//   display_name TEXT,
//   photo_url TEXT,
//   created_at TIMESTAMPTZ DEFAULT NOW(),
//   last_login_at TIMESTAMPTZ DEFAULT NOW()
// );

// CREATE TABLE transactions (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   user_id TEXT REFERENCES users(uid) ON DELETE CASCADE,
//   type TEXT NOT NULL, -- 'income' or 'expense'
//   amount NUMERIC(12, 2) NOT NULL,
//   category TEXT NOT NULL,
//   date DATE NOT NULL,
//   description TEXT,
//   is_recurring BOOLEAN DEFAULT FALSE,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );

// CREATE TABLE loans (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   user_id TEXT REFERENCES users(uid) ON DELETE CASCADE,
//   bank_name TEXT NOT NULL,
//   description TEXT,
//   installment_amount NUMERIC(12, 2) NOT NULL,
//   installments_count INTEGER NOT NULL,
//   start_date DATE NOT NULL,
//   end_date DATE NOT NULL, -- Calculated
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );

// -- Other tables (credit_cards, credit_card_purchases) would follow a similar pattern.
// -- For credit_cards, 'limit' might be 'limit_amount' to avoid SQL keyword clash.
// -- For credit_card_purchases, 'date' might be 'purchase_date'.

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

const DATABASE_MODE = process.env.DATABASE_MODE || 'local';
const DATABASE_URL = process.env.DATABASE_URL;

let pool: Pool | null = null;

if (DATABASE_MODE === 'postgres' && DATABASE_URL) {
  pool = new Pool({ connectionString: DATABASE_URL });
  pool.on('connect', () => console.log('Connected to PostgreSQL'));
  pool.on('error', (err) => console.error('PostgreSQL client error', err));
} else {
  console.log('Using local db.json for data storage.');
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

// Ensure default user exists in Postgres if in postgres mode
async function ensureDefaultUserInPostgres() {
  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const res = await pool.query('SELECT uid FROM users WHERE uid = $1', [DEFAULT_USER_ID]);
      if (res.rows.length === 0) {
        await pool.query(
          'INSERT INTO users (uid, email, display_name, created_at, last_login_at) VALUES ($1, $2, $3, $4, $5)',
          [DEFAULT_USER_ID, 'user@example.local', 'Local User', new Date(), new Date()]
        );
        console.log(`Default user ${DEFAULT_USER_ID} created in PostgreSQL.`);
      } else {
         await pool.query('UPDATE users SET last_login_at = $1 WHERE uid = $2', [new Date(), DEFAULT_USER_ID]);
      }
    } catch (err) {
      console.error('Error ensuring default user in PostgreSQL:', err);
      // This might happen if tables don't exist. Consider adding table creation logic or manual setup.
    }
  }
}
// Call it once on server start or before first DB operation.
// For Next.js server actions, this might be implicitly handled per request if needed,
// or we rely on it being called during app initialization if that's feasible.
// For now, let's ensure it's called before major operations.
ensureDefaultUserInPostgres();


export const upsertUser = async (): Promise<void> => {
  if (DATABASE_MODE === 'postgres' && pool) {
    await ensureDefaultUserInPostgres(); // Ensures user exists and updates last_login_at
    console.log(`Checked/Updated default user profile in PostgreSQL.`);
  } else {
    let db = await readDB();
    db = await ensureDefaultUserStructure(db);
    if (db.users[DEFAULT_USER_ID]) {
      db.users[DEFAULT_USER_ID].profile.lastLoginAt = Date.now();
    }
    await writeDB(db);
    console.log(`Checked/Updated default user profile in local DB.`);
  }
};


export interface AddTransactionResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export const addTransaction = async (transactionData: NewTransactionData): Promise<AddTransactionResult> => {
  await ensureDefaultUserInPostgres(); // Ensure user exists before adding transaction
  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const newTransactionId = randomUUID();
      const res = await pool.query(
        'INSERT INTO transactions (id, user_id, type, amount, category, date, description, is_recurring, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
        [
          newTransactionId,
          DEFAULT_USER_ID,
          transactionData.type,
          transactionData.amount,
          transactionData.category,
          transactionData.date,
          transactionData.description || null,
          transactionData.isRecurring || false,
          new Date(),
        ]
      );
      console.log(`Transaction ${res.rows[0].id} added for default user in PostgreSQL.`);
      return { success: true, transactionId: res.rows[0].id };
    } catch (error: any) {
      console.error("Error adding transaction to PostgreSQL:", error.message, error);
      return { success: false, error: "An error occurred while adding the transaction to PostgreSQL." };
    }
  } else {
    // Local DB logic
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
  }
};

export async function getTransactionsForUser(): Promise<Transaction[]> {
  await ensureDefaultUserInPostgres();
  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const res: QueryResult<Transaction> = await pool.query(
        'SELECT id, user_id as "userId", type, amount, category, date, description, is_recurring as "isRecurring", created_at as "createdAt" FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC',
        [DEFAULT_USER_ID]
      );
      // Ensure date is formatted as YYYY-MM-DD string if it comes as Date object from DB
      return res.rows.map(tx => ({
        ...tx,
        date: formatDateFns(new Date(tx.date), 'yyyy-MM-dd'),
        amount: Number(tx.amount) // Ensure amount is number
      }));
    } catch (error: any) {
      console.error(`Error fetching transactions for default user from PostgreSQL:`, error.message, error);
      return [];
    }
  } else {
    // Local DB logic
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
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

export const deleteTransaction = async (transactionId: string): Promise<DeleteResult> => {
  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const res = await pool.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [transactionId, DEFAULT_USER_ID]);
      if (res.rowCount === 0) {
        console.log(`Transaction ${transactionId} not found for default user in PostgreSQL.`);
        return { success: false, error: "Transaction not found." };
      }
      console.log(`Transaction ${transactionId} deleted for default user in PostgreSQL.`);
      return { success: true };
    } catch (error: any) {
      console.error("Error deleting transaction from PostgreSQL:", error.message, error);
      return { success: false, error: "An error occurred while deleting the transaction from PostgreSQL." };
    }
  } else {
    // Local DB logic
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
  }
};


export async function getFinancialDataForUser(): Promise<FinancialDataInput | null> {
  await ensureDefaultUserInPostgres();
  const userTransactions = await getTransactionsForUser(); 
  const userLoans = await getLoansForUser(); 

  try {
    const expensesByCategory: { [category: string]: number } = {};
    let totalIncomeThisMonth = 0; 

    userTransactions.forEach(tx => {
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

    const loansForAI = userLoans.map(loan => ({
      description: `${loan.bankName} - ${loan.description}`,
      amount: loan.installmentAmount * loan.installmentsCount,
      interestRate: 0, 
      monthlyPayment: loan.installmentAmount,
    }));
    
    const userCreditCards = await getCreditCardsForUser(); // NOT PG-aware yet

    return {
      income: incomeForAI, 
      expenses: expensesArray,
      loans: loansForAI,
      creditCards: userCreditCards.map(cc => ({
        name: cc.name,
        limit: cc.limit,
        balance: 0, 
        dueDate: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(cc.dueDateDay).padStart(2, '0')}`
      })),
    };

  } catch (error: any) {
    const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
    console.error(`Error fetching financial data for default user:`, errorMessage, error);
    return null;
  }
}

// Credit Card Specific Functions
export interface AddCreditCardResult {
  success: boolean;
  creditCardId?: string;
  error?: string;
}

// TODO: Implement PostgreSQL logic for Credit Cards
export const addCreditCard = async (creditCardData: NewCreditCardData): Promise<AddCreditCardResult> => {
  // if (DATABASE_MODE === 'postgres' && pool) { /* ... PG logic ... */ }
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

// TODO: Implement PostgreSQL logic for Credit Cards
export async function getCreditCardsForUser(): Promise<CreditCard[]> {
  // if (DATABASE_MODE === 'postgres' && pool) { /* ... PG logic ... */ }
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

// TODO: Implement PostgreSQL logic for Credit Card Purchases
export const addCreditCardPurchase = async (purchaseData: NewCreditCardPurchaseData): Promise<AddCreditCardPurchaseResult> => {
  // if (DATABASE_MODE === 'postgres' && pool) { /* ... PG logic ... */ }
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

// TODO: Implement PostgreSQL logic for Credit Card Purchases
export async function getCreditCardPurchasesForUser(): Promise<CreditCardPurchase[]> {
  // if (DATABASE_MODE === 'postgres' && pool) { /* ... PG logic ... */ }
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

// TODO: Implement PostgreSQL logic for Credit Card Purchases
export const deleteCreditCardPurchase = async (purchaseId: string): Promise<DeleteResult> => {
  // if (DATABASE_MODE === 'postgres' && pool) { /* ... PG logic ... */ }
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
  await ensureDefaultUserInPostgres();
  const startDateObj = parseISO(loanData.startDate);
  const endDateObj = addMonths(startDateObj, loanData.installmentsCount -1); 
  const calculatedEndDate = formatDateFns(endDateObj, 'yyyy-MM-dd');

  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const newLoanId = randomUUID();
      const res = await pool.query(
        'INSERT INTO loans (id, user_id, bank_name, description, installment_amount, installments_count, start_date, end_date, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
        [
          newLoanId,
          DEFAULT_USER_ID,
          loanData.bankName,
          loanData.description,
          loanData.installmentAmount,
          loanData.installmentsCount,
          loanData.startDate,
          calculatedEndDate,
          new Date(),
        ]
      );
      console.log(`Loan ${res.rows[0].id} added for default user in PostgreSQL. End date: ${calculatedEndDate}`);
      return { success: true, loanId: res.rows[0].id };
    } catch (error: any) {
      console.error("Error adding loan to PostgreSQL:", error.message, error);
      return { success: false, error: "An error occurred while adding the loan to PostgreSQL." };
    }
  } else {
    // Local DB logic
    try {
      let db = await readDB();
      db = await ensureDefaultUserStructure(db);

      const newLoan: Loan = {
        id: randomUUID(),
        userId: DEFAULT_USER_ID,
        bankName: loanData.bankName,
        description: loanData.description,
        installmentAmount: Number(loanData.installmentAmount),
        installmentsCount: Number(loanData.installmentsCount),
        startDate: loanData.startDate,
        endDate: calculatedEndDate, 
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
  }
};

export async function getLoansForUser(): Promise<Loan[]> {
  await ensureDefaultUserInPostgres();
  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const res: QueryResult<Loan> = await pool.query(
        'SELECT id, user_id as "userId", bank_name as "bankName", description, installment_amount as "installmentAmount", installments_count as "installmentsCount", start_date as "startDate", end_date as "endDate", created_at as "createdAt" FROM loans WHERE user_id = $1 ORDER BY start_date ASC, created_at DESC',
        [DEFAULT_USER_ID]
      );
      return res.rows.map(loan => ({
        ...loan,
        startDate: formatDateFns(new Date(loan.startDate), 'yyyy-MM-dd'),
        endDate: formatDateFns(new Date(loan.endDate), 'yyyy-MM-dd'),
        installmentAmount: Number(loan.installmentAmount),
        installmentsCount: Number(loan.installmentsCount)
      }));
    } catch (error: any) {
      console.error(`Error fetching loans for default user from PostgreSQL:`, error.message, error);
      return [];
    }
  } else {
    // Local DB logic
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
}

export const deleteLoan = async (loanId: string): Promise<DeleteResult> => {
  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const res = await pool.query('DELETE FROM loans WHERE id = $1 AND user_id = $2', [loanId, DEFAULT_USER_ID]);
      if (res.rowCount === 0) {
        console.log(`Loan ${loanId} not found for default user in PostgreSQL.`);
        return { success: false, error: "Loan not found." };
      }
      console.log(`Loan ${loanId} deleted for default user in PostgreSQL.`);
      return { success: true };
    } catch (error: any) {
      console.error("Error deleting loan from PostgreSQL:", error.message, error);
      return { success: false, error: "An error occurred while deleting the loan from PostgreSQL." };
    }
  } else {
    // Local DB logic
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
  }
};


    