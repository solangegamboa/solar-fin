
'use server';

import fs from 'fs/promises';
import path from 'path';
import type { UserProfile, Transaction, NewTransactionData, FinancialDataInput, CreditCard, NewCreditCardData, CreditCardPurchase, NewCreditCardPurchaseData, Loan, NewLoanData, UserCategory, NewUserCategoryData, UserBackupData } from '@/types';
import { randomUUID } from 'crypto';
import { parseISO, addMonths, format as formatDateFns } from 'date-fns';
import { Pool, type QueryResult } from 'pg';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(process.cwd(), 'src', 'data', 'db.json');

interface UserRecord extends UserProfile {
  hashedPassword?: string;
  transactions: Transaction[];
  loans: Loan[];
  creditCards: CreditCard[];
  creditCardPurchases: CreditCardPurchase[];
  categories: UserCategory[];
}
interface LocalDB {
  users: {
    [userId: string]: UserRecord;
  };
}

const defaultCategories: Omit<NewUserCategoryData, 'userId'>[] = [
  { name: 'Alimentação', isSystemDefined: true },
  { name: 'Transporte', isSystemDefined: true },
  { name: 'Moradia', isSystemDefined: true },
  { name: 'Saúde', isSystemDefined: true },
  { name: 'Educação', isSystemDefined: true },
  { name: 'Lazer', isSystemDefined: true },
  { name: 'Vestuário', isSystemDefined: true },
  { name: 'Contas Fixas', isSystemDefined: true },
  { name: 'Compras Online', isSystemDefined: true },
  { name: 'Salário', isSystemDefined: true },
  { name: 'Investimentos', isSystemDefined: true },
  { name: 'Presentes', isSystemDefined: true },
  { name: 'Cuidados Pessoais', isSystemDefined: true },
  { name: 'Viagens', isSystemDefined: true },
  { name: 'Serviços (Assinaturas)', isSystemDefined: true },
  { name: 'Impostos', isSystemDefined: true },
  { name: 'Outras Receitas', isSystemDefined: true },
  { name: 'Outras Despesas', isSystemDefined: true },
];


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
      const initialDb: LocalDB = { users: {} };
      await writeDB(initialDb);
      console.log('Created empty db.json.');
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

async function addDefaultCategoriesForUser(userId: string) {
  for (const catData of defaultCategories) {
    await addCategoryForUser(userId, catData.name, true);
  }
}

export async function createUser(email: string, password_plain: string, displayName?: string): Promise<UserProfile | null> {
  const hashedPassword = await bcrypt.hash(password_plain, 10);
  const userId = randomUUID();
  const now = Date.now();

  const newUserProfile: UserProfile = {
    id: userId,
    email,
    displayName: displayName || email.split('@')[0],
    createdAt: now,
    lastLoginAt: now,
  };

  if (DATABASE_MODE === 'postgres' && pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        'INSERT INTO app_users (id, email, hashed_password, display_name, created_at, last_login_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, display_name, created_at, last_login_at',
        [userId, email, hashedPassword, displayName || null, new Date(now), new Date(now)]
      );
      const dbUser = res.rows[0];
      
      for (const catData of defaultCategories) {
          const categoryId = randomUUID();
          await client.query(
              'INSERT INTO user_categories (id, user_id, name, is_system_defined, created_at) VALUES ($1, $2, $3, $4, $5)',
              [categoryId, userId, catData.name, catData.isSystemDefined || false, new Date()]
          );
      }
      await client.query('COMMIT');
      return {
        id: dbUser.id,
        email: dbUser.email,
        displayName: dbUser.display_name,
        createdAt: new Date(dbUser.created_at).getTime(),
        lastLoginAt: new Date(dbUser.last_login_at).getTime(),
      };
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Error creating user in PostgreSQL:', error.message);
      if (error.code === '23505' && error.constraint === 'app_users_email_key') { // Check specific constraint for email
        throw new Error('User with this email already exists.');
      }
      throw new Error('Could not create user in PostgreSQL.');
    } finally {
      client.release();
    }
  } else {
    const db = await readDB();
    if (Object.values(db.users).find(u => u.profile.email === email)) {
      throw new Error('User with this email already exists.');
    }
    db.users[userId] = {
      profile: newUserProfile,
      hashedPassword,
      transactions: [],
      loans: [],
      creditCards: [],
      creditCardPurchases: [],
      categories: [], // Initialize empty, then populate
    };
    await writeDB(db); // Write first to ensure user exists
    await addDefaultCategoriesForUser(userId); // Then add categories (which also writes to DB)
    return newUserProfile;
  }
}

export async function findUserByEmail(email: string): Promise<(UserProfile & { hashedPassword?: string }) | null> {
  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const res = await pool.query('SELECT id, email, display_name as "displayName", hashed_password as "hashedPassword", created_at as "createdAt", last_login_at as "lastLoginAt" FROM app_users WHERE email = $1', [email]);
      if (res.rows.length === 0) return null;
      const user = res.rows[0];
      user.createdAt = new Date(user.createdAt).getTime();
      user.lastLoginAt = new Date(user.lastLoginAt).getTime();
      return user;
    } catch (error: any) {
      console.error('Error finding user by email in PostgreSQL:', error.message);
      throw error;
    }
  } else {
    const db = await readDB();
    const foundUserEntry = Object.values(db.users).find(u => u.profile.email === email);
    if (!foundUserEntry) return null;
    return { ...foundUserEntry.profile, hashedPassword: foundUserEntry.hashedPassword };
  }
}

export async function findUserById(userId: string): Promise<UserProfile | null> {
  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const res = await pool.query('SELECT id, email, display_name as "displayName", created_at as "createdAt", last_login_at as "lastLoginAt" FROM app_users WHERE id = $1', [userId]);
      if (res.rows.length === 0) return null;
      const user = res.rows[0];
      user.createdAt = new Date(user.createdAt).getTime();
      user.lastLoginAt = new Date(user.lastLoginAt).getTime();
      return user;
    } catch (error: any) {
      console.error('Error finding user by ID in PostgreSQL:', error.message);
      throw error;
    }
  } else {
    const db = await readDB();
    const userData = db.users[userId];
    if (!userData) return null;
    return userData.profile;
  }
}

export async function updateUserLastLogin(userId: string): Promise<void> {
    const now = new Date();
    if (DATABASE_MODE === 'postgres' && pool) {
        try {
            await pool.query('UPDATE app_users SET last_login_at = $1 WHERE id = $2', [now, userId]);
        } catch (error: any) {
            console.error('Error updating last login in PostgreSQL:', error.message);
        }
    } else {
        const db = await readDB();
        if (db.users[userId] && db.users[userId].profile) {
            db.users[userId].profile.lastLoginAt = now.getTime();
            await writeDB(db);
        }
    }
}

export interface UpdateUserDisplayNameResult { success: boolean; user?: UserProfile; error?: string; }
export async function updateUserDisplayName(userId: string, newDisplayName: string): Promise<UpdateUserDisplayNameResult> {
  if (!userId) return { success: false, error: "User ID is required." };
  if (!newDisplayName.trim()) return { success: false, error: "Display name cannot be empty." };

  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const res = await pool.query(
        'UPDATE app_users SET display_name = $1 WHERE id = $2 RETURNING id, email, display_name, created_at, last_login_at',
        [newDisplayName.trim(), userId]
      );
      if (res.rowCount === 0) return { success: false, error: "User not found." };
      const dbUser = res.rows[0];
      return {
        success: true,
        user: {
          id: dbUser.id,
          email: dbUser.email,
          displayName: dbUser.display_name,
          createdAt: new Date(dbUser.created_at).getTime(),
          lastLoginAt: new Date(dbUser.last_login_at).getTime(),
        }
      };
    } catch (error: any) {
      console.error("Error updating display name in PostgreSQL:", error.message);
      return { success: false, error: "Database error updating display name." };
    }
  } else {
    const db = await readDB();
    if (!db.users[userId] || !db.users[userId].profile) {
      return { success: false, error: "User not found." };
    }
    db.users[userId].profile.displayName = newDisplayName.trim();
    await writeDB(db);
    return { success: true, user: db.users[userId].profile };
  }
}

export interface UpdateUserPasswordResult { success: boolean; error?: string; }
export async function updateUserPassword(userId: string, currentPasswordPlain: string, newPasswordPlain: string): Promise<UpdateUserPasswordResult> {
  if (!userId) return { success: false, error: "User ID is required." };

  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const userRes = await pool.query('SELECT hashed_password FROM app_users WHERE id = $1', [userId]);
      if (userRes.rowCount === 0) return { success: false, error: "User not found." };
      
      const hashedPasswordFromDb = userRes.rows[0].hashed_password;
      const isCurrentPasswordValid = await bcrypt.compare(currentPasswordPlain, hashedPasswordFromDb);
      if (!isCurrentPasswordValid) return { success: false, error: "Invalid current password." };

      const newHashedPassword = await bcrypt.hash(newPasswordPlain, 10);
      await pool.query('UPDATE app_users SET hashed_password = $1 WHERE id = $2', [newHashedPassword, userId]);
      return { success: true };
    } catch (error: any) {
      console.error("Error updating password in PostgreSQL:", error.message);
      return { success: false, error: "Database error updating password." };
    }
  } else {
    const db = await readDB();
    const userRecord = db.users[userId];
    if (!userRecord || !userRecord.profile || !userRecord.hashedPassword) {
      return { success: false, error: "User not found or no password set." };
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPasswordPlain, userRecord.hashedPassword);
    if (!isCurrentPasswordValid) return { success: false, error: "Invalid current password." };

    userRecord.hashedPassword = await bcrypt.hash(newPasswordPlain, 10);
    await writeDB(db);
    return { success: true };
  }
}


export interface AddTransactionResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}
export const addTransaction = async (userId: string, transactionData: NewTransactionData): Promise<AddTransactionResult> => {
  if (!userId) return { success: false, error: "User ID is required." };

  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const newTransactionId = randomUUID();
      // For PG, receipt_image_uri might be a TEXT column that can be null.
      const res = await pool.query(
        'INSERT INTO transactions (id, user_id, type, amount, category, date, description, is_recurring, created_at, receipt_image_uri) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id',
        [
          newTransactionId, userId, transactionData.type, transactionData.amount,
          transactionData.category, transactionData.date, transactionData.description || null,
          transactionData.isRecurring || false, new Date(), transactionData.receiptImageUri || null,
        ]
      );
      return { success: true, transactionId: res.rows[0].id };
    } catch (error: any) {
      console.error("Error adding transaction to PostgreSQL:", error.message);
      return { success: false, error: "Database error adding transaction." };
    }
  } else {
    const db = await readDB();
    if (!db.users[userId]) {
        console.error(`User ${userId} not found in local DB for addTransaction.`);
        return { success: false, error: "User not found." };
    }
    if (!db.users[userId].transactions) db.users[userId].transactions = [];
    const newTransaction: Transaction = {
      id: randomUUID(), userId, ...transactionData,
      isRecurring: transactionData.isRecurring || false, createdAt: Date.now(),
      // receiptImageUri is part of transactionData now
    };
    db.users[userId].transactions.push(newTransaction);
    await writeDB(db);
    return { success: true, transactionId: newTransaction.id };
  }
};

export async function getTransactionsForUser(userId: string): Promise<Transaction[]> {
  if (!userId) return [];

  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const res: QueryResult<Transaction> = await pool.query(
        'SELECT id, user_id as "userId", type, amount, category, date, description, is_recurring as "isRecurring", created_at as "createdAt", receipt_image_uri as "receiptImageUri" FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC',
        [userId]
      );
      return res.rows.map(tx => ({
        ...tx,
        date: formatDateFns(new Date(tx.date), 'yyyy-MM-dd'),
        amount: Number(tx.amount)
      }));
    } catch (error: any) {
      console.error(`Error fetching transactions for user ${userId} from PostgreSQL:`, error.message);
      return [];
    }
  } else {
    const db = await readDB();
    const userData = db.users[userId];
    if (!userData || !userData.transactions) return [];
    return [...userData.transactions].sort((a, b) => {
      const dateComparison = new Date(b.date).getTime() - new Date(a.date).getTime();
      return dateComparison !== 0 ? dateComparison : (b.createdAt || 0) - (a.createdAt || 0);
    });
  }
}

export interface DeleteResult { success: boolean; error?: string; }

export const deleteTransaction = async (userId: string, transactionId: string): Promise<DeleteResult> => {
  if (!userId) return { success: false, error: "User ID is required." };

  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const res = await pool.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [transactionId, userId]);
      if (res.rowCount === 0) return { success: false, error: "Transaction not found or not owned by user." };
      return { success: true };
    } catch (error: any) {
      console.error("Error deleting transaction from PostgreSQL:", error.message);
      return { success: false, error: "Database error deleting transaction." };
    }
  } else {
    const db = await readDB();
    if (!db.users[userId] || !db.users[userId].transactions) return { success: false, error: "User or transactions not found." };
    
    const initialLength = db.users[userId].transactions.length;
    db.users[userId].transactions = db.users[userId].transactions.filter(tx => tx.id !== transactionId);
    if (db.users[userId].transactions.length === initialLength) return { success: false, error: "Transaction not found." };
    
    await writeDB(db);
    return { success: true };
  }
};

export async function getFinancialDataForUser(userId: string): Promise<FinancialDataInput | null> {
  if (!userId) return null;
  
  const userTransactions = await getTransactionsForUser(userId);
  const userLoans = await getLoansForUser(userId); 
  const userCreditCards = await getCreditCardsForUser(userId); 

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
    
    const incomeForAI = totalIncomeThisMonth > 0 ? totalIncomeThisMonth : 5000; // Fallback for AI if no income

    const loansForAI = userLoans.map(loan => ({
      description: `${loan.bankName} - ${loan.description}`,
      amount: loan.installmentAmount * loan.installmentsCount,
      interestRate: 0, // Placeholder, as we don't store this
      monthlyPayment: loan.installmentAmount,
    }));
    
    return {
      income: incomeForAI,
      expenses: expensesArray,
      loans: loansForAI,
      creditCards: userCreditCards.map(cc => ({
        name: cc.name,
        limit: cc.limit,
        balance: 0, // Placeholder, balance is dynamic and not stored directly this way
        dueDate: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(cc.dueDateDay).padStart(2, '0')}`
      })),
    };
  } catch (error: any) {
    console.error(`Error fetching financial data for user ${userId}:`, error.message);
    return null;
  }
}

export interface AddLoanResult { success: boolean; loanId?: string; error?: string; }
export const addLoan = async (userId: string, loanData: NewLoanData): Promise<AddLoanResult> => {
   if (!userId) return { success: false, error: "User ID is required." };
    const startDateObj = parseISO(loanData.startDate);
    const endDateObj = addMonths(startDateObj, loanData.installmentsCount -1); 
    const calculatedEndDate = formatDateFns(endDateObj, 'yyyy-MM-dd');

    const newLoanId = randomUUID();
    if (DATABASE_MODE === 'postgres' && pool) {
        try {
            await pool.query(
                'INSERT INTO loans (id, user_id, bank_name, description, installment_amount, installments_count, start_date, end_date, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                [newLoanId, userId, loanData.bankName, loanData.description, loanData.installmentAmount, loanData.installmentsCount, loanData.startDate, calculatedEndDate, new Date()]
            );
            return { success: true, loanId: newLoanId };
        } catch (error: any) {
            console.error("Error adding loan to PostgreSQL:", error.message);
            return { success: false, error: "Database error adding loan." };
        }
    } else {
        const db = await readDB();
        if (!db.users[userId]) {
             console.error(`User ${userId} not found in local DB for addLoan.`);
             return { success: false, error: "User not found." };
        }
        if (!db.users[userId].loans) db.users[userId].loans = [];
        const newLoan: Loan = {
            id: newLoanId, userId, ...loanData, endDate: calculatedEndDate, createdAt: Date.now(),
        };
        db.users[userId].loans.push(newLoan);
        await writeDB(db);
        return { success: true, loanId: newLoan.id };
    }
};

export async function getLoansForUser(userId: string): Promise<Loan[]> {
    if (!userId) return [];
    if (DATABASE_MODE === 'postgres' && pool) {
        try {
            const res = await pool.query<Loan>(
                'SELECT id, user_id as "userId", bank_name as "bankName", description, installment_amount as "installmentAmount", installments_count as "installmentsCount", start_date as "startDate", end_date as "endDate", created_at as "createdAt" FROM loans WHERE user_id = $1 ORDER BY start_date ASC, created_at DESC',
                [userId]
            );
            return res.rows.map(loan => ({
                ...loan,
                startDate: formatDateFns(new Date(loan.startDate), 'yyyy-MM-dd'),
                endDate: formatDateFns(new Date(loan.endDate), 'yyyy-MM-dd'),
                installmentAmount: Number(loan.installmentAmount),
                installmentsCount: Number(loan.installmentsCount)
            }));
        } catch (error:any) {
            console.error(`Error fetching loans for user ${userId} from PG:`, error.message); return [];
        }
    } else {
        const db = await readDB();
        const userData = db.users[userId];
        if (!userData || !userData.loans) return [];
        return userData.loans.sort((a,b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
    }
}

export const deleteLoan = async (userId: string, loanId: string): Promise<DeleteResult> => {
    if (!userId) return { success: false, error: "User ID required." };
    if (DATABASE_MODE === 'postgres' && pool) {
       try {
            const res = await pool.query('DELETE FROM loans WHERE id = $1 AND user_id = $2', [loanId, userId]);
            if (res.rowCount === 0) return { success: false, error: "Loan not found or not owned by user." };
            return { success: true };
        } catch (error: any) {
            console.error("Error deleting loan from PostgreSQL:", error.message);
            return { success: false, error: "Database error deleting loan." };
        }
    } else {
        const db = await readDB();
        if (!db.users[userId] || !db.users[userId].loans) return { success: false, error: "User loans not found."};
        const initialLength = db.users[userId].loans.length;
        db.users[userId].loans = db.users[userId].loans.filter(l => l.id !== loanId);
        if (db.users[userId].loans.length === initialLength) return { success: false, error: "Loan not found."};
        await writeDB(db);
        return { success: true };
    }
};

export interface AddCreditCardResult { success: boolean; creditCardId?: string; error?: string; }
export const addCreditCard = async (userId: string, cardData: NewCreditCardData): Promise<AddCreditCardResult> => {
    if (!userId) return { success: false, error: "User ID required." };
    const newCardId = randomUUID();
    if (DATABASE_MODE === 'postgres' && pool) {
       try {
            await pool.query(
                'INSERT INTO credit_cards (id, user_id, name, limit_amount, due_date_day, closing_date_day, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [newCardId, userId, cardData.name, cardData.limit, cardData.dueDateDay, cardData.closingDateDay, new Date()]
            );
            return { success: true, creditCardId: newCardId };
        } catch (error: any) {
            console.error("Error adding credit card to PostgreSQL:", error.message);
            return { success: false, error: "Database error adding credit card." };
        }
    } else {
        const db = await readDB();
        if (!db.users[userId]) {
            console.error(`User ${userId} not found in local DB for addCreditCard.`);
            return { success: false, error: "User not found." };
        }
        if (!db.users[userId].creditCards) db.users[userId].creditCards = [];
        const newCard: CreditCard = { id: newCardId, userId, ...cardData, createdAt: Date.now() };
        db.users[userId].creditCards.push(newCard);
        await writeDB(db);
        return { success: true, creditCardId: newCardId };
    }
};

export async function getCreditCardsForUser(userId: string): Promise<CreditCard[]> {
     if (!userId) return [];
    if (DATABASE_MODE === 'postgres' && pool) {
        try {
            const res = await pool.query<CreditCard>('SELECT id, user_id as "userId", name, limit_amount as "limit", due_date_day as "dueDateDay", closing_date_day as "closingDateDay", created_at as "createdAt" FROM credit_cards WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
            return res.rows.map(cc => ({ ...cc, limit: Number(cc.limit) }));
        } catch (error: any) {
            console.error(`Error fetching credit cards for user ${userId} from PG:`, error.message); return [];
        }
    } else {
        const db = await readDB();
        const userData = db.users[userId];
        if (!userData || !userData.creditCards) return [];
        return userData.creditCards.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
}

export interface AddCreditCardPurchaseResult { success: boolean; purchaseId?: string; error?: string; }
export const addCreditCardPurchase = async (userId: string, purchaseData: NewCreditCardPurchaseData): Promise<AddCreditCardPurchaseResult> => {
    if (!userId) return { success: false, error: "User ID required." };
    const newPurchaseId = randomUUID();
    if (DATABASE_MODE === 'postgres' && pool) {
        try {
            await pool.query(
                'INSERT INTO credit_card_purchases (id, user_id, card_id, purchase_date, description, category, total_amount, installments, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                [newPurchaseId, userId, purchaseData.cardId, purchaseData.date, purchaseData.description, purchaseData.category, purchaseData.totalAmount, purchaseData.installments, new Date()]
            );
            return { success: true, purchaseId: newPurchaseId };
        } catch (error: any) {
            console.error("Error adding credit card purchase to PostgreSQL:", error.message);
            return { success: false, error: "Database error adding credit card purchase." };
        }
    } else {
        const db = await readDB();
        if (!db.users[userId]) {
            console.error(`User ${userId} not found in local DB for addCreditCardPurchase.`);
            return { success: false, error: "User not found." };
        }
        if (!db.users[userId].creditCardPurchases) db.users[userId].creditCardPurchases = [];
        const newPurchase: CreditCardPurchase = { id: newPurchaseId, userId, ...purchaseData, createdAt: Date.now() };
        db.users[userId].creditCardPurchases.push(newPurchase);
        await writeDB(db);
        return { success: true, purchaseId: newPurchaseId };
    }
};

export async function getCreditCardPurchasesForUser(userId: string): Promise<CreditCardPurchase[]> {
    if (!userId) return [];
    if (DATABASE_MODE === 'postgres' && pool) {
        try {
            const res = await pool.query<CreditCardPurchase>('SELECT id, user_id as "userId", card_id as "cardId", purchase_date as "date", description, category, total_amount as "totalAmount", installments, created_at as "createdAt" FROM credit_card_purchases WHERE user_id = $1 ORDER BY purchase_date DESC, created_at DESC', [userId]);
            return res.rows.map(p => ({...p, date: formatDateFns(new Date(p.date), 'yyyy-MM-dd'), totalAmount: Number(p.totalAmount)}));
        } catch (error: any) {
            console.error(`Error fetching credit card purchases for user ${userId} from PG:`, error.message); return [];
        }
    } else {
        const db = await readDB();
        const userData = db.users[userId];
        if (!userData || !userData.creditCardPurchases) return [];
        return userData.creditCardPurchases.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
}

export const deleteCreditCardPurchase = async (userId: string, purchaseId: string): Promise<DeleteResult> => {
    if (!userId) return { success: false, error: "User ID required." };
    if (DATABASE_MODE === 'postgres' && pool) {
        try {
            const res = await pool.query('DELETE FROM credit_card_purchases WHERE id = $1 AND user_id = $2', [purchaseId, userId]);
            if (res.rowCount === 0) return { success: false, error: "Purchase not found or not owned by user." };
            return { success: true };
        } catch (error: any) {
            console.error("Error deleting credit card purchase from PostgreSQL:", error.message);
            return { success: false, error: "Database error deleting credit card purchase." };
        }
    } else {
        const db = await readDB();
        if (!db.users[userId] || !db.users[userId].creditCardPurchases) return { success: false, error: "User purchases not found."};
        const initialLength = db.users[userId].creditCardPurchases.length;
        db.users[userId].creditCardPurchases = db.users[userId].creditCardPurchases.filter(p => p.id !== purchaseId);
        if (db.users[userId].creditCardPurchases.length === initialLength) return { success: false, error: "Purchase not found."};
        await writeDB(db);
        return { success: true };
    }
};


export async function getCategoriesForUser(userId: string): Promise<UserCategory[]> {
    if (!userId) return [];
    if (DATABASE_MODE === 'postgres' && pool) {
        try {
            const res = await pool.query<UserCategory>(
                'SELECT id, user_id as "userId", name, is_system_defined as "isSystemDefined", created_at as "createdAt" FROM user_categories WHERE user_id = $1 ORDER BY name ASC',
                [userId]
            );
            return res.rows.map(cat => ({...cat, createdAt: new Date(cat.createdAt).getTime() }));
        } catch (error: any) {
            console.error(`Error fetching categories for user ${userId} from PostgreSQL:`, error.message);
            return [];
        }
    } else {
        const db = await readDB();
        const userData = db.users[userId];
        if (!userData || !userData.categories) return [];
        return [...userData.categories].sort((a, b) => a.name.localeCompare(b.name));
    }
}

export interface AddCategoryResult { success: boolean; category?: UserCategory; error?: string; }
export const addCategoryForUser = async (userId: string, categoryName: string, isSystemDefined: boolean = false): Promise<AddCategoryResult> => {
    if (!userId) return { success: false, error: "User ID is required." };
    if (!categoryName.trim()) return { success: false, error: "Category name cannot be empty." };

    const newCategoryId = randomUUID();
    const now = Date.now();

    if (DATABASE_MODE === 'postgres' && pool) {
        try {
            const res = await pool.query(
                'INSERT INTO user_categories (id, user_id, name, is_system_defined, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, name) DO NOTHING RETURNING id, user_id as "userId", name, is_system_defined as "isSystemDefined", created_at as "createdAt"',
                [newCategoryId, userId, categoryName.trim(), isSystemDefined, new Date(now)]
            );
            if (res.rows.length > 0) {
                 const cat = res.rows[0];
                 return { success: true, category: {...cat, createdAt: new Date(cat.createdAt).getTime()} };
            } else {
                // If ON CONFLICT DO NOTHING happened, fetch the existing one
                const existingRes = await pool.query('SELECT id, user_id as "userId", name, is_system_defined as "isSystemDefined", created_at as "createdAt" FROM user_categories WHERE user_id = $1 AND name = $2', [userId, categoryName.trim()]);
                if (existingRes.rows.length > 0) {
                    const cat = existingRes.rows[0];
                    return { success: true, category: {...cat, createdAt: new Date(cat.createdAt).getTime()}, error: "Category already exists." }; // technically success as it exists
                }
                return { success: false, error: "Category already exists, but failed to retrieve." };
            }
        } catch (error: any) {
            console.error("Error adding category to PostgreSQL:", error.message);
             if (error.code === '23505') { // Unique violation (should be caught by ON CONFLICT)
                return { success: false, error: "Category already exists." };
            }
            return { success: false, error: "Database error adding category." };
        }
    } else {
        const db = await readDB();
        if (!db.users[userId]) {
            console.error(`User ${userId} not found in local DB for addCategoryForUser.`);
            return { success: false, error: "User not found." };
        }
        if (!db.users[userId].categories) db.users[userId].categories = [];

        const existingCategory = db.users[userId].categories.find(c => c.name.toLowerCase() === categoryName.trim().toLowerCase());
        if (existingCategory) {
            return { success: true, category: existingCategory, error: "Category already exists." };
        }

        const newCategory: UserCategory = {
            id: newCategoryId,
            userId,
            name: categoryName.trim(),
            isSystemDefined,
            createdAt: now,
        };
        db.users[userId].categories.push(newCategory);
        await writeDB(db);
        return { success: true, category: newCategory };
    }
};


async function migrateOldDbStructure() {
    if (DATABASE_MODE === 'local') {
        try {
            const rawData = await fs.readFile(DB_PATH, 'utf-8');
            const db = JSON.parse(rawData);
            
            if (!db.users || (db.users && !Object.keys(db.users).every(key => typeof db.users[key]?.profile === 'object'))) {
                 if (db.transactions || db.loans || db.creditCards || db.creditCardPurchases) { 
                    console.log("Old db.json structure detected. Migrating to multi-user structure...");
                    const defaultUserId = "default-user-migrated-id"; 
                    const newDb: LocalDB = {
                        users: {
                            [defaultUserId]: {
                                profile: {
                                    id: defaultUserId,
                                    email: "migrated@example.local",
                                    displayName: "Migrated User",
                                    createdAt: Date.now(),
                                    lastLoginAt: Date.now(),
                                },
                                hashedPassword: await bcrypt.hash("password", 10),
                                transactions: (db.transactions || []).map((tx: any) => ({...tx, userId: defaultUserId})),
                                loans: (db.loans || []).map((l: any) => ({...l, userId: defaultUserId})),
                                creditCards: (db.creditCards || []).map((cc: any) => ({...cc, userId: defaultUserId})),
                                creditCardPurchases: (db.creditCardPurchases || []).map((p: any) => ({...p, userId: defaultUserId})),
                                categories: (defaultCategories.map(cat => ({id: randomUUID(), userId: defaultUserId, name: cat.name, isSystemDefined: cat.isSystemDefined || false, createdAt: Date.now() }))) // Add default categories during migration
                            }
                        }
                    };
                    await writeDB(newDb);
                    console.log("db.json migrated. Data moved under 'migrated@example.local'. Please update password or create new users.");
                 } else if (!db.users) { // If db.json is completely empty or malformed to not have users key
                    await writeDB({ users: {} });
                    console.log("Initialized empty users object in db.json.");
                 }
            } else {
                // New structure already in place, ensure all users have categories array
                let modified = false;
                for (const userId in db.users) {
                    if (!db.users[userId].categories) {
                        db.users[userId].categories = [];
                        // Populate with defaults if it's an existing user without categories
                         defaultCategories.forEach(cat => {
                             if (!db.users[userId].categories.find(c => c.name === cat.name)) {
                                db.users[userId].categories.push({
                                    id: randomUUID(),
                                    userId: userId,
                                    name: cat.name,
                                    isSystemDefined: cat.isSystemDefined || false,
                                    createdAt: Date.now()
                                });
                             }
                        });
                        modified = true;
                    }
                }
                if (modified) {
                    await writeDB(db);
                    console.log("Ensured all users have a categories array, populated defaults where missing.");
                }
            }
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                await writeDB({ users: {} }); 
            } else {
                console.error("Error during DB migration check:", error);
            }
        }
    }
}

export async function getUserBackupData(userId: string): Promise<UserBackupData | null> {
  if (!userId) return null;
  const userProfile = await findUserById(userId);
  if (!userProfile) return null;

  // For PostgreSQL, you would query each table. For local, you read from the user's record.
  if (DATABASE_MODE === 'postgres' && pool) {
    // This is a simplified example. In a real PG setup, you'd make separate queries.
    const transactions = await getTransactionsForUser(userId);
    const loans = await getLoansForUser(userId);
    const creditCards = await getCreditCardsForUser(userId);
    const creditCardPurchases = await getCreditCardPurchasesForUser(userId);
    const categories = await getCategoriesForUser(userId);
    return {
      profile: { email: userProfile.email, displayName: userProfile.displayName || undefined },
      transactions,
      loans,
      creditCards,
      creditCardPurchases,
      categories,
    };
  } else {
    // Local db.json mode
    const db = await readDB();
    const userData = db.users[userId];
    if (!userData) return null;
    return {
      profile: { email: userData.profile.email, displayName: userData.profile.displayName || undefined },
      transactions: userData.transactions || [],
      loans: userData.loans || [],
      creditCards: userData.creditCards || [],
      creditCardPurchases: userData.creditCardPurchases || [],
      categories: userData.categories || [],
    };
  }
}

export async function restoreUserBackupData(userId: string, backupData: UserBackupData): Promise<DeleteResult> {
  if (!userId) return { success: false, error: "User ID is required for restore." };

  // Validate backupData structure (basic check)
  if (!backupData || typeof backupData.profile !== 'object' || !Array.isArray(backupData.transactions) || !Array.isArray(backupData.loans) || !Array.isArray(backupData.creditCards) || !Array.isArray(backupData.creditCardPurchases) || !Array.isArray(backupData.categories)) {
    return { success: false, error: "Invalid backup file structure." };
  }
  
  if (DATABASE_MODE === 'postgres' && pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Clear existing user data - BE VERY CAREFUL WITH THESE QUERIES
      await client.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM loans WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM credit_card_purchases WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM credit_cards WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM user_categories WHERE user_id = $1', [userId]);
      // User profile (displayName) can be updated if needed, email is key.
      if (backupData.profile.displayName) {
        await client.query('UPDATE app_users SET display_name = $1 WHERE id = $2', [backupData.profile.displayName, userId]);
      }

      // Insert new data from backup
      for (const tx of backupData.transactions) {
        await client.query('INSERT INTO transactions (id, user_id, type, amount, category, date, description, is_recurring, created_at, receipt_image_uri) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          [tx.id, userId, tx.type, tx.amount, tx.category, tx.date, tx.description, tx.isRecurring, new Date(tx.createdAt), tx.receiptImageUri]);
      }
      for (const loan of backupData.loans) {
         await client.query('INSERT INTO loans (id, user_id, bank_name, description, installment_amount, installments_count, start_date, end_date, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [loan.id, userId, loan.bankName, loan.description, loan.installmentAmount, loan.installmentsCount, loan.startDate, loan.endDate, new Date(loan.createdAt)]);
      }
      for (const card of backupData.creditCards) {
         await client.query('INSERT INTO credit_cards (id, user_id, name, limit_amount, due_date_day, closing_date_day, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [card.id, userId, card.name, card.limit, card.dueDateDay, card.closingDateDay, new Date(card.createdAt)]);
      }
      for (const purchase of backupData.creditCardPurchases) {
        await client.query('INSERT INTO credit_card_purchases (id, user_id, card_id, purchase_date, description, category, total_amount, installments, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [purchase.id, userId, purchase.cardId, purchase.date, purchase.description, purchase.category, purchase.totalAmount, purchase.installments, new Date(purchase.createdAt)]);
      }
      for (const category of backupData.categories) {
         await client.query('INSERT INTO user_categories (id, user_id, name, is_system_defined, created_at) VALUES ($1, $2, $3, $4, $5)',
          [category.id, userId, category.name, category.isSystemDefined, new Date(category.createdAt)]);
      }
      await client.query('COMMIT');
      return { success: true };
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error("Error restoring user data in PostgreSQL:", error.message);
      return { success: false, error: "Database error during restore." };
    } finally {
      client.release();
    }
  } else {
    // Local db.json mode
    const db = await readDB();
    const userRecord = db.users[userId];
    if (!userRecord) return { success: false, error: "User not found." };

    // Update profile details from backup if they exist
    if (backupData.profile.displayName) {
        userRecord.profile.displayName = backupData.profile.displayName;
    }
    // We don't update email from backup as it's the primary identifier.

    userRecord.transactions = backupData.transactions.map(t => ({...t, userId}));
    userRecord.loans = backupData.loans.map(l => ({...l, userId}));
    userRecord.creditCards = backupData.creditCards.map(cc => ({...cc, userId}));
    userRecord.creditCardPurchases = backupData.creditCardPurchases.map(p => ({...p, userId}));
    userRecord.categories = backupData.categories.map(cat => ({...cat, userId}));

    await writeDB(db);
    return { success: true };
  }
}

// Run migration check on server start
migrateOldDbStructure().catch(err => console.error("Migration check failed:", err));

