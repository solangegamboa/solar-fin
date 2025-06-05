
'use server';

import fs from 'fs/promises';
import path from 'path';
import type { UserProfile, Transaction, NewTransactionData, FinancialDataInput } from '@/types';
import { randomUUID } from 'crypto';

// Path to the local JSON database file
const DB_PATH = path.join(process.cwd(), 'src', 'data', 'db.json');
const DEFAULT_USER_ID = 'default_user'; // Centralized default user ID

interface LocalDB {
  users: {
    [uid: string]: {
      profile: UserProfile;
      transactions: Transaction[];
      loans?: any[]; // Kept for structural consistency, not fully implemented
      creditCards?: any[]; // Kept for structural consistency, not fully implemented
    };
  };
}

// Helper function to read the database
async function readDB(): Promise<LocalDB> {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(data) as LocalDB;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // If db.json doesn't exist, create it with a default structure
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
          },
        },
      };
      await writeDB(initialDb);
      console.log('Created db.json with default user structure.');
      return initialDb;
    }
    console.error('Error reading database file:', error.message, error);
    throw new Error('Could not read database.');
  }
}

// Helper function to write to the database
async function writeDB(data: LocalDB): Promise<void> {
  try {
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error: any) {
    console.error('Error writing to database file:', error.message, error);
    throw new Error('Could not write to database.');
  }
}

// Ensures the default user profile and basic structure exists in db.json
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
    };
    console.log(`Default user structure created in local DB for ${DEFAULT_USER_ID}.`);
  } else {
    // Ensure sub-arrays exist if profile exists but arrays are missing
    if (!db.users[DEFAULT_USER_ID].transactions) db.users[DEFAULT_USER_ID].transactions = [];
    if (!db.users[DEFAULT_USER_ID].loans) db.users[DEFAULT_USER_ID].loans = [];
    if (!db.users[DEFAULT_USER_ID].creditCards) db.users[DEFAULT_USER_ID].creditCards = [];
  }
  return db;
}

/**
 * Ensures the default user profile exists and updates last login time.
 */
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
      userId: DEFAULT_USER_ID, // Always use default user
      ...transactionData,
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
    // Sort by date (string YYYY-MM-DD) descending, then by createdAt descending as a tie-breaker
    return transactions.sort((a, b) => {
      if (b.date < a.date) return -1;
      if (b.date > a.date) return 1;
      return b.createdAt - a.createdAt;
    });
  } catch (error: any) {
    const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
    console.error(`Error fetching transactions for default user from local DB:`, errorMessage, error);
    return []; // Return empty array on error
  }
}


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
    let totalIncomeThisMonth = 0; // This might need more sophisticated date filtering if truly "this month"

    // For simplicity, we'll sum all income transactions for the AI.
    // And all expenses.
    (userData.transactions || []).forEach(tx => {
      // Consider filtering by month if this data is meant to be monthly
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

    // Provide a default income if none found, so AI flow has something to work with
    const incomeForAI = totalIncomeThisMonth > 0 ? totalIncomeThisMonth : 5000; // Default to 5000 if no income found

    return {
      income: incomeForAI, // Using a simplified total income
      expenses: expensesArray,
      // Using placeholder/empty arrays for loans and credit cards as per previous scope
      loans: userData.loans || [],
      creditCards: userData.creditCards || [],
    };

  } catch (error: any) {
    const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
    console.error(`Error fetching financial data for default user from local DB:`, errorMessage, error);
    return null;
  }
}
