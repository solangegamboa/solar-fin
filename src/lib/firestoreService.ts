
'use server';

import { doc, setDoc, serverTimestamp, getDoc, type Timestamp, collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import type { TransactionType } from '@/types';

export interface UserDocument {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  createdAt: Timestamp | any; // serverTimestamp() para criação
  lastLoginAt: Timestamp | any; // serverTimestamp() para atualização
  // Outros campos específicos do app podem ser adicionados aqui no futuro
}

/**
 * Salva ou atualiza os dados do usuário no Firestore.
 * Se o usuário não existir no Firestore, cria um novo documento com createdAt e lastLoginAt.
 * Se existir, atualiza displayName, photoURL (se houver) e lastLoginAt.
 */
export const upsertUserInFirestore = async (firebaseUser: FirebaseUser): Promise<void> => {
  if (!firebaseUser) {
    console.error("upsertUserInFirestore: firebaseUser não fornecido.");
    return;
  }

  const userRef = doc(db, 'users', firebaseUser.uid);
  
  const dataToPersist: Partial<UserDocument> = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    lastLoginAt: serverTimestamp(),
  };

  try {
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // Novo usuário no Firestore, definir createdAt
      dataToPersist.createdAt = serverTimestamp();
      await setDoc(userRef, dataToPersist);
      console.log(`Novo usuário ${firebaseUser.uid} salvo no Firestore.`);
    } else {
      // Usuário existente, mesclar dados para atualizar e não sobrescrever createdAt
      await setDoc(userRef, dataToPersist, { merge: true });
      console.log(`Dados do usuário ${firebaseUser.uid} atualizados no Firestore.`);
    }
  } catch (error) {
    console.error("Erro ao salvar/atualizar usuário no Firestore:", error);
    // Considerar relançar o erro ou tratar de forma mais específica se necessário
    // throw error; 
  }
};

export interface NewTransactionData {
  type: TransactionType;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  description?: string;
}

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
    const transactionsCollectionRef = collection(db, 'users', userId, 'transactions');
    const docRef = await addDoc(transactionsCollectionRef, {
      ...transactionData,
      createdAt: serverTimestamp(),
    });
    return { success: true, transactionId: docRef.id };
  } catch (error: any) {
    console.error("Error adding transaction to Firestore:", error);
    let errorMessage = "Failed to add transaction due to an unknown error.";
    if (error instanceof Error) {
      errorMessage = `Failed to add transaction: ${error.message}`;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error.message === 'string') {
      errorMessage = `Failed to add transaction: ${error.message}`;
    }
    return { success: false, error: errorMessage };
  }
};

