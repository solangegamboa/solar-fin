
'use server';

import fs from 'fs/promises';
import path from 'path';
import type { UserProfile, Transaction, NewTransactionData, FinancialDataInput, CreditCard, NewCreditCardData, CreditCardPurchase, NewCreditCardPurchaseData, Loan, NewLoanData, UserCategory, NewUserCategoryData, UserBackupData, FinancialGoal, NewFinancialGoalData, UpdateFinancialGoalData, RecurrenceFrequency, Investment, NewInvestmentData, UpdateInvestmentData, InvestmentType } from '@/types';
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
  financialGoals: FinancialGoal[];
  investments: Investment[]; // Added
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
    notifyByEmail: false, // Default notification preference
  };

  if (DATABASE_MODE === 'postgres' && pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        'INSERT INTO app_users (id, email, hashed_password, display_name, created_at, last_login_at, notify_by_email) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, email, display_name, created_at, last_login_at, notify_by_email',
        [userId, email, hashedPassword, displayName || null, new Date(now), new Date(now), false]
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
        notifyByEmail: dbUser.notify_by_email,
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
      categories: [],
      financialGoals: [],
      investments: [], // Added
    };
    await writeDB(db);
    await addDefaultCategoriesForUser(userId); 
    return newUserProfile;
  }
}

export async function findUserByEmail(email: string): Promise<(UserProfile & { hashedPassword?: string }) | null> {
  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const res = await pool.query('SELECT id, email, display_name as "displayName", hashed_password as "hashedPassword", created_at as "createdAt", last_login_at as "lastLoginAt", notify_by_email as "notifyByEmail" FROM app_users WHERE email = $1', [email]);
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
      const res = await pool.query('SELECT id, email, display_name as "displayName", created_at as "createdAt", last_login_at as "lastLoginAt", notify_by_email as "notifyByEmail" FROM app_users WHERE id = $1', [userId]);
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
        'UPDATE app_users SET display_name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, display_name, created_at, last_login_at, notify_by_email, updated_at',
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
          notifyByEmail: dbUser.notify_by_email,
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
    // db.users[userId].profile.updatedAt = Date.now(); // Assuming UserProfile has updatedAt
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
      await pool.query('UPDATE app_users SET hashed_password = $1, updated_at = NOW() WHERE id = $2', [newHashedPassword, userId]);
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

export interface UpdateEmailNotificationPrefsResult { success: boolean; user?: UserProfile; error?: string; }
export async function updateUserEmailNotificationPreference(userId: string, notifyByEmail: boolean): Promise<UpdateEmailNotificationPrefsResult> {
  if (!userId) return { success: false, error: "User ID is required." };

  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const res = await pool.query(
        'UPDATE app_users SET notify_by_email = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, display_name, created_at, last_login_at, notify_by_email, updated_at',
        [notifyByEmail, userId]
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
          notifyByEmail: dbUser.notify_by_email,
        }
      };
    } catch (error: any) {
      console.error("Error updating email notification preference in PostgreSQL:", error.message);
      return { success: false, error: "Database error updating email notification preference." };
    }
  } else {
    const db = await readDB();
    if (!db.users[userId] || !db.users[userId].profile) {
      return { success: false, error: "User not found." };
    }
    db.users[userId].profile.notifyByEmail = notifyByEmail;
    // db.users[userId].profile.updatedAt = Date.now();
    await writeDB(db);
    return { success: true, user: db.users[userId].profile };
  }
}


export interface AddTransactionResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}
export const addTransaction = async (userId: string, transactionData: NewTransactionData): Promise<AddTransactionResult> => {
  if (!userId) return { success: false, error: "User ID is required." };

  const newTransactionId = randomUUID();
  const now = new Date();
  const recurrenceFrequency = transactionData.recurrenceFrequency || 'none';

  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const res = await pool.query(
        'INSERT INTO transactions (id, user_id, type, amount, category, date, description, recurrence_frequency, receipt_image_uri, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id',
        [
          newTransactionId, userId, transactionData.type, transactionData.amount,
          transactionData.category, transactionData.date, transactionData.description || null,
          recurrenceFrequency, transactionData.receiptImageUri || null, now, now
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
    const nowTs = now.getTime();
    const newTransaction: Transaction = {
      id: newTransactionId,
      userId,
      type: transactionData.type,
      amount: transactionData.amount,
      category: transactionData.category,
      date: transactionData.date,
      description: transactionData.description,
      recurrenceFrequency: recurrenceFrequency,
      receiptImageUri: transactionData.receiptImageUri,
      createdAt: nowTs,
      updatedAt: nowTs,
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
      const res = await pool.query<Transaction>(
        'SELECT id, user_id as "userId", type, amount, category, date, description, recurrence_frequency as "recurrenceFrequency", created_at as "createdAt", updated_at as "updatedAt", receipt_image_uri as "receiptImageUri" FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC',
        [userId]
      );
      return res.rows.map(tx => ({
        ...tx,
        date: formatDateFns(new Date(tx.date), 'yyyy-MM-dd'),
        amount: Number(tx.amount),
        recurrenceFrequency: (tx.recurrenceFrequency || 'none') as RecurrenceFrequency,
        createdAt: new Date(tx.createdAt).getTime(),
        updatedAt: tx.updatedAt ? new Date(tx.updatedAt).getTime() : new Date(tx.createdAt).getTime(),
      }));
    } catch (error: any) {
      console.error(`Error fetching transactions for user ${userId} from PostgreSQL:`, error.message);
      return [];
    }
  } else {
    const db = await readDB();
    const userData = db.users[userId];
    if (!userData || !userData.transactions) return [];
    
    // Migration logic for old 'isRecurring' field
    const migratedTransactions = userData.transactions.map(tx => {
      let frequency = tx.recurrenceFrequency || 'none';
      const txAsAny = tx as any; // To access old field for migration
      if (txAsAny.hasOwnProperty('isRecurring') && typeof txAsAny.isRecurring === 'boolean') {
          if (txAsAny.isRecurring && frequency === 'none') {
              frequency = 'monthly'; 
          }
          delete txAsAny.isRecurring; 
      }
      return { ...tx, recurrenceFrequency: frequency as RecurrenceFrequency, updatedAt: tx.updatedAt || tx.createdAt };
    });

    return migratedTransactions.sort((a, b) => {
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
  const userInvestments = await getInvestmentsForUser(userId); // Added

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
    
    const incomeForAI = totalIncomeThisMonth > 0 ? totalIncomeThisMonth : 5000; // Default if no income this month

    const loansForAI = userLoans.map(loan => ({
      description: `${loan.bankName} - ${loan.description}`,
      amount: loan.installmentAmount * loan.installmentsCount,
      interestRate: 0, // Placeholder, interest rate isn't stored
      monthlyPayment: loan.installmentAmount,
    }));

    const investmentsForAI = userInvestments.map(inv => ({
        name: inv.name,
        type: inv.type,
        currentValue: inv.currentValue,
        initialAmount: inv.initialAmount,
        symbol: inv.symbol,
    }));
    
    return {
      income: incomeForAI,
      expenses: expensesArray,
      loans: loansForAI,
      creditCards: userCreditCards.map(cc => ({
        name: cc.name,
        limit: cc.limit,
        balance: 0, // Placeholder, actual balance not tracked directly here
        dueDate: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(cc.dueDateDay).padStart(2, '0')}`
      })),
      investments: investmentsForAI, // Added
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
    const now = new Date();
    if (DATABASE_MODE === 'postgres' && pool) {
        try {
            await pool.query(
                'INSERT INTO loans (id, user_id, bank_name, description, installment_amount, installments_count, start_date, end_date, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
                [newLoanId, userId, loanData.bankName, loanData.description, loanData.installmentAmount, loanData.installmentsCount, loanData.startDate, calculatedEndDate, now, now]
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
        const nowTs = now.getTime();
        const newLoan: Loan = {
            id: newLoanId, userId, ...loanData, endDate: calculatedEndDate, createdAt: nowTs, updatedAt: nowTs,
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
                'SELECT id, user_id as "userId", bank_name as "bankName", description, installment_amount as "installmentAmount", installments_count as "installmentsCount", start_date as "startDate", end_date as "endDate", created_at as "createdAt", updated_at as "updatedAt" FROM loans WHERE user_id = $1 ORDER BY start_date ASC, created_at DESC',
                [userId]
            );
            return res.rows.map(loan => ({
                ...loan,
                startDate: formatDateFns(new Date(loan.startDate), 'yyyy-MM-dd'),
                endDate: formatDateFns(new Date(loan.endDate), 'yyyy-MM-dd'),
                installmentAmount: Number(loan.installmentAmount),
                installmentsCount: Number(loan.installmentsCount),
                createdAt: new Date(loan.createdAt).getTime(),
                updatedAt: loan.updatedAt ? new Date(loan.updatedAt).getTime() : new Date(loan.createdAt).getTime(),
            }));
        } catch (error:any) {
            console.error(`Error fetching loans for user ${userId} from PG:`, error.message); return [];
        }
    } else {
        const db = await readDB();
        const userData = db.users[userId];
        if (!userData || !userData.loans) return [];
        return userData.loans.map(l => ({...l, updatedAt: l.updatedAt || l.createdAt})).sort((a,b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
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
    const now = new Date();
    if (DATABASE_MODE === 'postgres' && pool) {
       try {
            await pool.query(
                'INSERT INTO credit_cards (id, user_id, name, limit_amount, due_date_day, closing_date_day, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [newCardId, userId, cardData.name, cardData.limit, cardData.dueDateDay, cardData.closingDateDay, now, now]
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
        const nowTs = now.getTime();
        const newCard: CreditCard = { id: newCardId, userId, ...cardData, createdAt: nowTs, updatedAt: nowTs };
        db.users[userId].creditCards.push(newCard);
        await writeDB(db);
        return { success: true, creditCardId: newCardId };
    }
};

export async function getCreditCardsForUser(userId: string): Promise<CreditCard[]> {
     if (!userId) return [];
    if (DATABASE_MODE === 'postgres' && pool) {
        try {
            const res = await pool.query<CreditCard>('SELECT id, user_id as "userId", name, limit_amount as "limit", due_date_day as "dueDateDay", closing_date_day as "closingDateDay", created_at as "createdAt", updated_at as "updatedAt" FROM credit_cards WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
            return res.rows.map(cc => ({ ...cc, limit: Number(cc.limit), createdAt: new Date(cc.createdAt).getTime(), updatedAt: cc.updatedAt ? new Date(cc.updatedAt).getTime() : new Date(cc.createdAt).getTime() }));
        } catch (error: any) {
            console.error(`Error fetching credit cards for user ${userId} from PG:`, error.message); return [];
        }
    } else {
        const db = await readDB();
        const userData = db.users[userId];
        if (!userData || !userData.creditCards) return [];
        return userData.creditCards.map(cc => ({...cc, updatedAt: cc.updatedAt || cc.createdAt})).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
}

export interface AddCreditCardPurchaseResult { success: boolean; purchaseId?: string; error?: string; }
export const addCreditCardPurchase = async (userId: string, purchaseData: NewCreditCardPurchaseData): Promise<AddCreditCardPurchaseResult> => {
    if (!userId) return { success: false, error: "User ID required." };
    const newPurchaseId = randomUUID();
    const now = new Date();
    if (DATABASE_MODE === 'postgres' && pool) {
        try {
            await pool.query(
                'INSERT INTO credit_card_purchases (id, user_id, card_id, purchase_date, description, category, total_amount, installments, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
                [newPurchaseId, userId, purchaseData.cardId, purchaseData.date, purchaseData.description, purchaseData.category, purchaseData.totalAmount, purchaseData.installments, now, now]
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
        const nowTs = now.getTime();
        const newPurchase: CreditCardPurchase = { id: newPurchaseId, userId, ...purchaseData, createdAt: nowTs, updatedAt: nowTs };
        db.users[userId].creditCardPurchases.push(newPurchase);
        await writeDB(db);
        return { success: true, purchaseId: newPurchaseId };
    }
};

export async function getCreditCardPurchasesForUser(userId: string): Promise<CreditCardPurchase[]> {
    if (!userId) return [];
    if (DATABASE_MODE === 'postgres' && pool) {
        try {
            const res = await pool.query<CreditCardPurchase>('SELECT id, user_id as "userId", card_id as "cardId", purchase_date as "date", description, category, total_amount as "totalAmount", installments, created_at as "createdAt", updated_at as "updatedAt" FROM credit_card_purchases WHERE user_id = $1 ORDER BY purchase_date DESC, created_at DESC', [userId]);
            return res.rows.map(p => ({...p, date: formatDateFns(new Date(p.date), 'yyyy-MM-dd'), totalAmount: Number(p.totalAmount), createdAt: new Date(p.createdAt).getTime(), updatedAt: p.updatedAt ? new Date(p.updatedAt).getTime() : new Date(p.createdAt).getTime()}));
        } catch (error: any) {
            console.error(`Error fetching credit card purchases for user ${userId} from PG:`, error.message); return [];
        }
    } else {
        const db = await readDB();
        const userData = db.users[userId];
        if (!userData || !userData.creditCardPurchases) return [];
        return userData.creditCardPurchases.map(p => ({...p, updatedAt: p.updatedAt || p.createdAt})).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
                const existingRes = await pool.query('SELECT id, user_id as "userId", name, is_system_defined as "isSystemDefined", created_at as "createdAt" FROM user_categories WHERE user_id = $1 AND name = $2', [userId, categoryName.trim()]);
                if (existingRes.rows.length > 0) {
                    const cat = existingRes.rows[0];
                    return { success: true, category: {...cat, createdAt: new Date(cat.createdAt).getTime()}, error: "Category already exists." }; 
                }
                return { success: false, error: "Category already exists, but failed to retrieve." };
            }
        } catch (error: any) {
            console.error("Error adding category to PostgreSQL:", error.message);
             if (error.code === '23505') { 
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

export interface AddFinancialGoalResult { success: boolean; goalId?: string; error?: string; }
export const addFinancialGoal = async (userId: string, goalData: NewFinancialGoalData): Promise<AddFinancialGoalResult> => {
  if (!userId) return { success: false, error: "User ID is required." };
  const newGoalId = randomUUID();
  const now = new Date();

  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      await pool.query(
        'INSERT INTO financial_goals (id, user_id, name, target_amount, current_amount, target_date, description, icon, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [
          newGoalId, userId, goalData.name, goalData.targetAmount,
          goalData.currentAmount || 0, goalData.targetDate || null,
          goalData.description || null, goalData.icon || null,
          goalData.status || 'active', now, now
        ]
      );
      return { success: true, goalId: newGoalId };
    } catch (error: any) {
      console.error("Error adding financial goal to PostgreSQL:", error.message);
      return { success: false, error: "Database error adding financial goal." };
    }
  } else {
    const db = await readDB();
    if (!db.users[userId]) return { success: false, error: "User not found." };
    if (!db.users[userId].financialGoals) db.users[userId].financialGoals = [];
    const nowTs = now.getTime();
    const newGoal: FinancialGoal = {
      id: newGoalId, userId,
      name: goalData.name,
      targetAmount: goalData.targetAmount,
      currentAmount: goalData.currentAmount || 0,
      targetDate: goalData.targetDate || null,
      description: goalData.description || null,
      icon: goalData.icon || null,
      status: goalData.status || 'active',
      createdAt: nowTs,
      updatedAt: nowTs,
    };
    db.users[userId].financialGoals.push(newGoal);
    await writeDB(db);
    return { success: true, goalId: newGoalId };
  }
};

export async function getFinancialGoalsForUser(userId: string): Promise<FinancialGoal[]> {
  if (!userId) return [];
  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const res = await pool.query<FinancialGoal>(
        'SELECT id, user_id AS "userId", name, target_amount AS "targetAmount", current_amount AS "currentAmount", target_date AS "targetDate", description, icon, status, created_at AS "createdAt", updated_at AS "updatedAt" FROM financial_goals WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return res.rows.map(g => ({
        ...g,
        targetAmount: Number(g.targetAmount),
        currentAmount: Number(g.currentAmount),
        createdAt: new Date(g.createdAt).getTime(),
        updatedAt: new Date(g.updatedAt).getTime(),
        targetDate: g.targetDate ? formatDateFns(new Date(g.targetDate), 'yyyy-MM-dd') : null,
      }));
    } catch (error: any) {
      console.error("Error fetching financial goals from PostgreSQL:", error.message);
      return [];
    }
  } else {
    const db = await readDB();
    const userData = db.users[userId];
    return userData?.financialGoals?.map(g => ({...g, updatedAt: g.updatedAt || g.createdAt})).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) || [];
  }
}

export interface UpdateFinancialGoalResult { success: boolean; error?: string; }
export const updateFinancialGoal = async (userId: string, goalId: string, updateData: UpdateFinancialGoalData): Promise<UpdateFinancialGoalResult> => {
  if (!userId || !goalId) return { success: false, error: "User ID and Goal ID are required." };
  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let queryIndex = 1;

      Object.entries(updateData).forEach(([key, value]) => {
        if (value !== undefined) { 
          const dbKey = key === 'targetAmount' ? 'target_amount' : key === 'currentAmount' ? 'current_amount' : key === 'targetDate' ? 'target_date' : key;
          fields.push(`${dbKey} = $${queryIndex++}`);
          values.push(value);
        }
      });

      if (fields.length === 0) return { success: true }; 

      fields.push(`updated_at = $${queryIndex++}`); 
      values.push(new Date()); 
      
      values.push(goalId, userId); 

      const query = `UPDATE financial_goals SET ${fields.join(', ')} WHERE id = $${queryIndex++} AND user_id = $${queryIndex++}`;
      const res = await pool.query(query, values);

      if (res.rowCount === 0) return { success: false, error: "Goal not found or not owned by user." };
      return { success: true };
    } catch (error: any) {
      console.error("Error updating financial goal in PostgreSQL:", error.message);
      return { success: false, error: "Database error updating financial goal." };
    }
  } else {
    const db = await readDB();
    if (!db.users[userId]?.financialGoals) return { success: false, error: "User or goals not found." };
    const goalIndex = db.users[userId].financialGoals.findIndex(g => g.id === goalId);
    if (goalIndex === -1) return { success: false, error: "Goal not found." };

    db.users[userId].financialGoals[goalIndex] = {
      ...db.users[userId].financialGoals[goalIndex],
      ...updateData, 
      updatedAt: Date.now(),
    };
    await writeDB(db);
    return { success: true };
  }
};

export const deleteFinancialGoal = async (userId: string, goalId: string): Promise<DeleteResult> => {
  if (!userId || !goalId) return { success: false, error: "User ID and Goal ID are required." };
  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const res = await pool.query('DELETE FROM financial_goals WHERE id = $1 AND user_id = $2', [goalId, userId]);
      if (res.rowCount === 0) return { success: false, error: "Goal not found or not owned by user." };
      return { success: true };
    } catch (error: any) {
      console.error("Error deleting financial goal from PostgreSQL:", error.message);
      return { success: false, error: "Database error deleting financial goal." };
    }
  } else {
    const db = await readDB();
    if (!db.users[userId]?.financialGoals) return { success: false, error: "User or goals not found." };
    const initialLength = db.users[userId].financialGoals.length;
    db.users[userId].financialGoals = db.users[userId].financialGoals.filter(g => g.id !== goalId);
    if (db.users[userId].financialGoals.length === initialLength) return { success: false, error: "Goal not found." };
    await writeDB(db);
    return { success: true };
  }
};

// Investment Functions
export interface AddInvestmentResult { success: boolean; investmentId?: string; error?: string; }
export const addInvestment = async (userId: string, investmentData: NewInvestmentData): Promise<AddInvestmentResult> => {
  if (!userId) return { success: false, error: "User ID is required." };
  const newInvestmentId = randomUUID();
  const now = new Date();

  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      await pool.query(
        'INSERT INTO investments (id, user_id, name, type, initial_amount, current_value, quantity, symbol, institution, acquisition_date, notes, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
        [
          newInvestmentId, userId, investmentData.name, investmentData.type,
          investmentData.initialAmount || null, investmentData.currentValue,
          investmentData.quantity || null, investmentData.symbol || null,
          investmentData.institution || null, investmentData.acquisitionDate || null,
          investmentData.notes || null, now, now
        ]
      );
      return { success: true, investmentId: newInvestmentId };
    } catch (error: any) {
      console.error("Error adding investment to PostgreSQL:", error.message);
      return { success: false, error: "Database error adding investment." };
    }
  } else {
    const db = await readDB();
    if (!db.users[userId]) return { success: false, error: "User not found." };
    if (!db.users[userId].investments) db.users[userId].investments = [];
    const nowTs = now.getTime();
    const newInvestment: Investment = {
      id: newInvestmentId, userId,
      ...investmentData,
      createdAt: nowTs,
      updatedAt: nowTs,
    };
    db.users[userId].investments.push(newInvestment);
    await writeDB(db);
    return { success: true, investmentId: newInvestmentId };
  }
};

export async function getInvestmentsForUser(userId: string): Promise<Investment[]> {
  if (!userId) return [];
  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const res = await pool.query<Investment>(
        'SELECT id, user_id AS "userId", name, type, initial_amount AS "initialAmount", current_value AS "currentValue", quantity, symbol, institution, acquisition_date AS "acquisitionDate", notes, created_at AS "createdAt", updated_at AS "updatedAt" FROM investments WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return res.rows.map(inv => ({
        ...inv,
        initialAmount: inv.initialAmount != null ? Number(inv.initialAmount) : null,
        currentValue: Number(inv.currentValue),
        quantity: inv.quantity != null ? Number(inv.quantity) : null,
        createdAt: new Date(inv.createdAt).getTime(),
        updatedAt: new Date(inv.updatedAt).getTime(),
        acquisitionDate: inv.acquisitionDate ? formatDateFns(new Date(inv.acquisitionDate), 'yyyy-MM-dd') : null,
      }));
    } catch (error: any) {
      console.error("Error fetching investments from PostgreSQL:", error.message);
      return [];
    }
  } else {
    const db = await readDB();
    const userData = db.users[userId];
    return userData?.investments?.map(inv => ({...inv, updatedAt: inv.updatedAt || inv.createdAt })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) || [];
  }
}

export interface UpdateInvestmentResult { success: boolean; error?: string; }
export const updateInvestment = async (userId: string, investmentId: string, updateData: UpdateInvestmentData): Promise<UpdateInvestmentResult> => {
  if (!userId || !investmentId) return { success: false, error: "User ID and Investment ID are required." };
  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let queryIndex = 1;

      (Object.keys(updateData) as Array<keyof UpdateInvestmentData>).forEach(key => {
        if (updateData[key] !== undefined) {
          const dbKeyMap: Record<keyof UpdateInvestmentData, string> = {
            name: 'name', type: 'type', initialAmount: 'initial_amount', currentValue: 'current_value',
            quantity: 'quantity', symbol: 'symbol', institution: 'institution',
            acquisitionDate: 'acquisition_date', notes: 'notes',
          };
          fields.push(`${dbKeyMap[key]} = $${queryIndex++}`);
          values.push(updateData[key]);
        }
      });
      
      if (fields.length === 0) return { success: true }; // No fields to update

      fields.push(`updated_at = $${queryIndex++}`);
      values.push(new Date());
      values.push(investmentId, userId); // For WHERE clause

      const query = `UPDATE investments SET ${fields.join(', ')} WHERE id = $${queryIndex++} AND user_id = $${queryIndex++}`;
      const res = await pool.query(query, values);

      if (res.rowCount === 0) return { success: false, error: "Investment not found or not owned by user." };
      return { success: true };
    } catch (error: any) {
      console.error("Error updating investment in PostgreSQL:", error.message);
      return { success: false, error: "Database error updating investment." };
    }
  } else {
    const db = await readDB();
    if (!db.users[userId]?.investments) return { success: false, error: "User or investments not found." };
    const invIndex = db.users[userId].investments.findIndex(inv => inv.id === investmentId);
    if (invIndex === -1) return { success: false, error: "Investment not found." };

    db.users[userId].investments[invIndex] = {
      ...db.users[userId].investments[invIndex],
      ...updateData,
      updatedAt: Date.now(),
    };
    await writeDB(db);
    return { success: true };
  }
};

export const deleteInvestment = async (userId: string, investmentId: string): Promise<DeleteResult> => {
  if (!userId || !investmentId) return { success: false, error: "User ID and Investment ID are required." };
  if (DATABASE_MODE === 'postgres' && pool) {
    try {
      const res = await pool.query('DELETE FROM investments WHERE id = $1 AND user_id = $2', [investmentId, userId]);
      if (res.rowCount === 0) return { success: false, error: "Investment not found or not owned by user." };
      return { success: true };
    } catch (error: any) {
      console.error("Error deleting investment from PostgreSQL:", error.message);
      return { success: false, error: "Database error deleting investment." };
    }
  } else {
    const db = await readDB();
    if (!db.users[userId]?.investments) return { success: false, error: "User or investments not found." };
    const initialLength = db.users[userId].investments.length;
    db.users[userId].investments = db.users[userId].investments.filter(inv => inv.id !== investmentId);
    if (db.users[userId].investments.length === initialLength) return { success: false, error: "Investment not found." };
    await writeDB(db);
    return { success: true };
  }
};


async function migrateOldDbStructure() {
    if (DATABASE_MODE === 'local') {
        try {
            const rawData = await fs.readFile(DB_PATH, 'utf-8');
            const db = JSON.parse(rawData);
            
            let modified = false;
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
                                    notifyByEmail: false,
                                },
                                hashedPassword: await bcrypt.hash("password", 10),
                                transactions: (db.transactions || []).map((tx: any) => {
                                    const migratedTx: Transaction = {...tx, userId: defaultUserId, recurrenceFrequency: tx.isRecurring ? 'monthly' : 'none', updatedAt: tx.updatedAt || tx.createdAt };
                                    delete (migratedTx as any).isRecurring;
                                    return migratedTx;
                                }),
                                loans: (db.loans || []).map((l: any) => ({...l, userId: defaultUserId, updatedAt: l.updatedAt || l.createdAt})),
                                creditCards: (db.creditCards || []).map((cc: any) => ({...cc, userId: defaultUserId, updatedAt: cc.updatedAt || cc.createdAt})),
                                creditCardPurchases: (db.creditCardPurchases || []).map((p: any) => ({...p, userId: defaultUserId, updatedAt: p.updatedAt || p.createdAt})),
                                categories: (defaultCategories.map(cat => ({id: randomUUID(), userId: defaultUserId, name: cat.name, isSystemDefined: cat.isSystemDefined || false, createdAt: Date.now() }))),
                                financialGoals: [],
                                investments: [], // Added
                            }
                        }
                    };
                    await writeDB(newDb);
                    console.log("db.json migrated. Data moved under 'migrated@example.local'. Please update password or create new users.");
                    modified = true; 
                 } else if (!db.users) { 
                    await writeDB({ users: {} });
                    console.log("Initialized empty users object in db.json.");
                 }
            }
            
            if (db.users) {
              for (const userId in db.users) {
                  if (db.users[userId] && db.users[userId].profile) { 
                      const userRecord = db.users[userId];
                      if (!userRecord.categories) {
                          userRecord.categories = [];
                          defaultCategories.forEach(cat => {
                              if (!userRecord.categories.find(c => c.name === cat.name)) {
                                  userRecord.categories.push({
                                      id: randomUUID(), userId: userId, name: cat.name,
                                      isSystemDefined: cat.isSystemDefined || false, createdAt: Date.now()
                                  });
                              }
                          });
                          modified = true;
                      }
                      if (!userRecord.financialGoals) { 
                          userRecord.financialGoals = [];
                          modified = true;
                      }
                       if (!userRecord.investments) { // Added
                          userRecord.investments = [];
                          modified = true;
                      }
                      if (userRecord.profile.notifyByEmail === undefined) {
                          userRecord.profile.notifyByEmail = false;
                          modified = true;
                      }
                      if (userRecord.transactions) {
                          userRecord.transactions = userRecord.transactions.map(tx => {
                              const txAsAny = tx as any;
                              let frequency = tx.recurrenceFrequency || 'none';
                              let txModified = false;
                              if (txAsAny.hasOwnProperty('isRecurring') && typeof txAsAny.isRecurring === 'boolean') {
                                  if (txAsAny.isRecurring && frequency === 'none') {
                                      frequency = 'monthly';
                                  }
                                  delete txAsAny.isRecurring;
                                  txModified = true;
                              }
                              if (!tx.updatedAt) {
                                  tx.updatedAt = tx.createdAt;
                                  txModified = true;
                              }
                              if(txModified) modified = true;
                              return { ...tx, recurrenceFrequency: frequency as RecurrenceFrequency, updatedAt: tx.updatedAt };
                          });
                      }
                      const ensureUpdatedAt = (items: any[] | undefined) => {
                        if(items) {
                          return items.map(item => {
                            if(!item.updatedAt) { modified = true; return {...item, updatedAt: item.createdAt}; }
                            return item;
                          });
                        }
                        return items;
                      };
                      userRecord.loans = ensureUpdatedAt(userRecord.loans) || [];
                      userRecord.creditCards = ensureUpdatedAt(userRecord.creditCards) || [];
                      userRecord.creditCardPurchases = ensureUpdatedAt(userRecord.creditCardPurchases) || [];
                      userRecord.financialGoals = ensureUpdatedAt(userRecord.financialGoals) || [];
                      userRecord.investments = ensureUpdatedAt(userRecord.investments) || [];

                  }
              }
            }

            if (modified) {
                await writeDB(db);
                console.log("db.json structure updated for all users (categories, financialGoals, investments, recurrenceFrequency, notifyByEmail, updatedAt fields).");
            }
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                await writeDB({ users: {} }); 
                 console.log("Initialized empty db.json as it was not found during migration check.");
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

  const profileForBackup: UserBackupData['profile'] = {
    email: userProfile.email,
    displayName: userProfile.displayName || undefined,
    notifyByEmail: userProfile.notifyByEmail || false,
  };

  if (DATABASE_MODE === 'postgres' && pool) {
    const transactions = await getTransactionsForUser(userId);
    const loans = await getLoansForUser(userId);
    const creditCards = await getCreditCardsForUser(userId);
    const creditCardPurchases = await getCreditCardPurchasesForUser(userId);
    const categories = await getCategoriesForUser(userId);
    const financialGoals = await getFinancialGoalsForUser(userId);
    const investments = await getInvestmentsForUser(userId); // Added
    return {
      profile: profileForBackup,
      transactions, loans, creditCards, creditCardPurchases, categories, financialGoals, investments, // Added
    };
  } else {
    const db = await readDB();
    const userData = db.users[userId];
    if (!userData) return null;

    const cleanedTransactions = (userData.transactions || []).map(tx => {
      const { ...cleanedTx } = tx; 
      if ((cleanedTx as any).isRecurring !== undefined) { 
        if (!cleanedTx.recurrenceFrequency || cleanedTx.recurrenceFrequency === 'none') {
          cleanedTx.recurrenceFrequency = (cleanedTx as any).isRecurring ? 'monthly' : 'none';
        }
        delete (cleanedTx as any).isRecurring;
      } else if (!cleanedTx.recurrenceFrequency) {
        cleanedTx.recurrenceFrequency = 'none';
      }
      return cleanedTx;
    });

    return {
      profile: profileForBackup,
      transactions: cleanedTransactions,
      loans: userData.loans || [],
      creditCards: userData.creditCards || [],
      creditCardPurchases: userData.creditCardPurchases || [],
      categories: userData.categories || [],
      financialGoals: userData.financialGoals || [],
      investments: userData.investments || [], // Added
    };
  }
}

export async function restoreUserBackupData(userId: string, backupData: UserBackupData): Promise<DeleteResult> {
  if (!userId) return { success: false, error: "User ID is required for restore." };

  if (!backupData || typeof backupData.profile !== 'object' || !Array.isArray(backupData.transactions) || !Array.isArray(backupData.loans) || !Array.isArray(backupData.creditCards) || !Array.isArray(backupData.creditCardPurchases) || !Array.isArray(backupData.categories) || !Array.isArray(backupData.financialGoals) || !Array.isArray(backupData.investments) ) { // Added investments check
    return { success: false, error: "Invalid backup file structure." };
  }
  
  if (DATABASE_MODE === 'postgres' && pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM investments WHERE user_id = $1', [userId]); // Added
      await client.query('DELETE FROM financial_goals WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM loans WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM credit_card_purchases WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM credit_cards WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM user_categories WHERE user_id = $1', [userId]);
      
      let updateUserQuery = 'UPDATE app_users SET updated_at = NOW(), '; // Ensure updated_at is always set
      const updateUserValues = [];
      let valueIndex = 1;
      if (backupData.profile.displayName) {
        updateUserQuery += `display_name = $${valueIndex++}, `;
        updateUserValues.push(backupData.profile.displayName);
      }
      updateUserQuery += `notify_by_email = $${valueIndex++} WHERE id = $${valueIndex++}`;
      updateUserValues.push(backupData.profile.notifyByEmail || false, userId);
      await client.query(updateUserQuery, updateUserValues);


      for (const tx of backupData.transactions) {
        await client.query('INSERT INTO transactions (id, user_id, type, amount, category, date, description, recurrence_frequency, created_at, receipt_image_uri, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
          [tx.id, userId, tx.type, tx.amount, tx.category, tx.date, tx.description, tx.recurrenceFrequency || 'none', new Date(tx.createdAt), tx.receiptImageUri, new Date(tx.updatedAt || tx.createdAt)]);
      }
      for (const loan of backupData.loans) {
         await client.query('INSERT INTO loans (id, user_id, bank_name, description, installment_amount, installments_count, start_date, end_date, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          [loan.id, userId, loan.bankName, loan.description, loan.installmentAmount, loan.installmentsCount, loan.startDate, loan.endDate, new Date(loan.createdAt), new Date(loan.updatedAt || loan.createdAt)]);
      }
      for (const card of backupData.creditCards) {
         await client.query('INSERT INTO credit_cards (id, user_id, name, limit_amount, due_date_day, closing_date_day, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [card.id, userId, card.name, card.limit, card.dueDateDay, card.closingDateDay, new Date(card.createdAt), new Date(card.updatedAt || card.createdAt)]);
      }
      for (const purchase of backupData.creditCardPurchases) {
        await client.query('INSERT INTO credit_card_purchases (id, user_id, card_id, purchase_date, description, category, total_amount, installments, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          [purchase.id, userId, purchase.cardId, purchase.date, purchase.description, purchase.category, purchase.totalAmount, purchase.installments, new Date(purchase.createdAt), new Date(purchase.updatedAt || purchase.createdAt)]);
      }
      for (const category of backupData.categories) {
         await client.query('INSERT INTO user_categories (id, user_id, name, is_system_defined, created_at) VALUES ($1, $2, $3, $4, $5)', 
          [category.id, userId, category.name, category.isSystemDefined, new Date(category.createdAt)]);
      }
      for (const goal of backupData.financialGoals) {
        await client.query('INSERT INTO financial_goals (id, user_id, name, target_amount, current_amount, target_date, description, icon, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
          [goal.id, userId, goal.name, goal.targetAmount, goal.currentAmount, goal.targetDate || null, goal.description || null, goal.icon || null, goal.status, new Date(goal.createdAt), new Date(goal.updatedAt || goal.createdAt)]);
      }
      for (const inv of backupData.investments) { // Added
        await client.query('INSERT INTO investments (id, user_id, name, type, initial_amount, current_value, quantity, symbol, institution, acquisition_date, notes, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
          [inv.id, userId, inv.name, inv.type, inv.initialAmount, inv.currentValue, inv.quantity, inv.symbol, inv.institution, inv.acquisitionDate, inv.notes, new Date(inv.createdAt), new Date(inv.updatedAt || inv.createdAt)]);
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
    const db = await readDB();
    const userRecord = db.users[userId];
    if (!userRecord) return { success: false, error: "User not found." };

    userRecord.profile.displayName = backupData.profile.displayName || userRecord.profile.displayName;
    userRecord.profile.notifyByEmail = backupData.profile.notifyByEmail === undefined ? userRecord.profile.notifyByEmail : backupData.profile.notifyByEmail;


    userRecord.transactions = backupData.transactions.map(t => ({...t, userId, recurrenceFrequency: t.recurrenceFrequency || 'none'}));
    userRecord.loans = backupData.loans.map(l => ({...l, userId}));
    userRecord.creditCards = backupData.creditCards.map(cc => ({...cc, userId}));
    userRecord.creditCardPurchases = backupData.creditCardPurchases.map(p => ({...p, userId}));
    userRecord.categories = backupData.categories.map(cat => ({...cat, userId}));
    userRecord.financialGoals = backupData.financialGoals.map(g => ({...g, userId}));
    userRecord.investments = backupData.investments.map(inv => ({...inv, userId})); // Added

    await writeDB(db);
    return { success: true };
  }
}

migrateOldDbStructure().catch(err => console.error("Migration check failed:", err));
