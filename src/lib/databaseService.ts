
'use server';

import fs from 'fs/promises';
import path from 'path';
import type { User as FirebaseUser } from 'firebase/auth';
import type { UserProfile, Transaction, TransactionType, NewTransactionData, FinancialDataInput } from '@/types'; // Added FinancialDataInput
import { randomUUID } from 'crypto';

// Path to the local JSON database file
const DB_PATH = path.join(process.cwd(), 'src', 'data', 'db.json');

interface LocalDB {
  users: {
    [uid: string]: {
      profile: UserProfile;
      transactions: Transaction[];
      // Placeholder for future extension, if needed
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
      // File doesn't exist, return an empty DB structure
      const initialDb: LocalDB = { users: {} };
      await writeDB(initialDb); // Create the file with initial structure
      return initialDb;
    }
    console.error('Error reading database file:', error);
    throw new Error('Could not read database.');
  }
}

// Helper function to write to the database
async function writeDB(data: LocalDB): Promise<void> {
  try {
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to database file:', error);
    throw new Error('Could not write to database.');
  }
}

/**
 * Saves or updates user data in the local JSON file.
 */
export const upsertUser = async (firebaseUser: FirebaseUser): Promise<void> => {
  if (!firebaseUser) {
    console.error("upsertUser: firebaseUser not provided.");
    return;
  }

  const db = await readDB();

  const userData: UserProfile = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName || null,
    photoURL: firebaseUser.photoURL || null,
    lastLoginAt: Date.now(),
  };

  if (!db.users[firebaseUser.uid]) {
    db.users[firebaseUser.uid] = {
      profile: {
        ...userData,
        createdAt: Date.now(),
      },
      transactions: [],
      loans: [],
      creditCards: [],
    };
    console.log(`New user ${firebaseUser.uid} created in local DB.`);
  } else {
    db.users[firebaseUser.uid].profile = {
      ...db.users[firebaseUser.uid].profile, // Preserve existing fields like createdAt
      ...userData, // Update with new data
    };
    console.log(`User data for ${firebaseUser.uid} updated in local DB.`);
  }

  await writeDB(db);
};
export const upsertUserInFirestore = upsertUser; // Alias for compatibility if old name is used elsewhere

export interface AddTransactionResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export const addTransaction = async (userId: string, transactionData: NewTransactionData): Promise<AddTransactionResult> => {
  if (!userId) {
    return { success: false, error: "User ID is required to add a transaction." };
  }

  try {
    const db = await readDB();

    if (!db.users[userId]) {
      console.error(`User ${userId} not found in local DB. Cannot add transaction.`);
      return { success: false, error: "User profile not found. Cannot add transaction." };
    }
    
    if (!db.users[userId].transactions) {
        db.users[userId].transactions = [];
    }

    const newTransaction: Transaction = {
      id: randomUUID(),
      userId,
      ...transactionData,
      createdAt: Date.now(),
    };

    db.users[userId].transactions.push(newTransaction);
    await writeDB(db);

    console.log(`Transaction ${newTransaction.id} added for user ${userId} in local DB.`);
    return { success: true, transactionId: newTransaction.id };
  } catch (error: any) {
    const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
    console.error("Error adding transaction to local DB:", errorMessage, error);
    return { success: false, error: "An error occurred while adding the transaction." };
  }
};

/**
 * Fetches and prepares financial data for the AI insights flow for a given user.
 */
export async function getFinancialDataForUser(userId: string): Promise<FinancialDataInput | null> {
  if (!userId) {
    console.error("getFinancialDataForUser: userId not provided.");
    return null;
  }

  try {
    const db = await readDB();
    const userData = db.users[userId];

    if (!userData) {
      console.log(`User ${userId} not found in local DB for financial data.`);
      return null;
    }

    const expensesByCategory: { [category: string]: number } = {};
    let totalIncomeThisMonth = 0; // Placeholder, needs better logic

    (userData.transactions || []).forEach(tx => {
      if (tx.type === 'expense') {
        expensesByCategory[tx.category] = (expensesByCategory[tx.category] || 0) + tx.amount;
      } else if (tx.type === 'income') {
        // Basic income sum, assuming all income transactions are for the current "month"
        // This is a simplification. Real income calculation would be more complex.
        totalIncomeThisMonth += tx.amount; 
      }
    });

    const expensesArray = Object.entries(expensesByCategory).map(([category, amount]) => ({
      category,
      amount,
    }));

    // Using a placeholder for income if no income transactions are found
    // Or, you might want to fetch this from user profile settings if stored there
    const incomeForAI = totalIncomeThisMonth > 0 ? totalIncomeThisMonth : 5000; // Default to 5000 BRL if no income tx

    return {
      income: incomeForAI, 
      expenses: expensesArray,
      // For now, loans and creditCards are empty as per the focus on persistence change
      loans: userData.loans || [], 
      creditCards: userData.creditCards || [],
    };

  } catch (error: any) {
    const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
    console.error(`Error fetching financial data for user ${userId} from local DB:`, errorMessage, error);
    return null;
  }
}
