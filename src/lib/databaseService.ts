
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
      loans?: any[];
      creditCards?: any[];
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
      const initialDb: LocalDB = { users: {} };
      await writeDB(initialDb);
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
 * (No longer upserts based on FirebaseUser)
 * This function is effectively a no-op now or could be used to update the default user's static profile if needed.
 * For now, its primary role of creating user profiles is handled by ensureDefaultUserStructure.
 */
export const upsertUser = async (): Promise<void> => {
  // This function is largely a no-op now as the default user is static
  // and its structure is ensured by other functions.
  // We can call ensureDefaultUserStructure here if we want to be explicit on some trigger.
  let db = await readDB();
  db = await ensureDefaultUserStructure(db);
  // Update lastLoginAt for the default user if desired
  if (db.users[DEFAULT_USER_ID]) {
    db.users[DEFAULT_USER_ID].profile.lastLoginAt = Date.now();
  }
  await writeDB(db);
  console.log(`Checked/Updated default user profile in local DB.`);
};
export const upsertUserInFirestore = upsertUser;


export interface AddTransactionResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export const addTransaction = async (transactionData: NewTransactionData): Promise<AddTransactionResult> => {
  try {
    let db = await readDB();
    db = await ensureDefaultUserStructure(db); // Ensure default user structure exists

    const newTransaction: Transaction = {
      id: randomUUID(),
      userId: DEFAULT_USER_ID,
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

export async function getFinancialDataForUser(): Promise<FinancialDataInput | null> {
  try {
    let db = await readDB();
    db = await ensureDefaultUserStructure(db); // Ensure default user structure exists

    const userData = db.users[DEFAULT_USER_ID];

    if (!userData) { // Should not happen if ensureDefaultUserStructure works
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

    return {
      income: incomeForAI,
      expenses: expensesArray,
      loans: userData.loans || [],
      creditCards: userData.creditCards || [],
    };

  } catch (error: any) {
    const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
    console.error(`Error fetching financial data for default user from local DB:`, errorMessage, error);
    return null;
  }
}
