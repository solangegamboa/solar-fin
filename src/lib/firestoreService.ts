
// ATENÇÃO: Este arquivo foi modificado para usar o Firebase Realtime Database.
// Considere renomeá-lo para algo como 'databaseService.ts' para maior clareza.
'use server';

import { ref, set, get, update, push, child, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { rtdb } from './firebase'; // Importa rtdb em vez de db
import type { User as FirebaseUser } from 'firebase/auth';
import type { TransactionType } from '@/types';

export interface UserDocument {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  createdAt: number | object; // Para rtdbServerTimestamp, será um objeto antes de ser resolvido
  lastLoginAt: number | object; // Para rtdbServerTimestamp
}

/**
 * Salva ou atualiza os dados do usuário no Firebase Realtime Database.
 */
export const upsertUserInFirestore = async (firebaseUser: FirebaseUser): Promise<void> => { // Nome da função mantido para minimizar alterações de interface, mas opera no RTDB
  if (!firebaseUser) {
    console.error("upsertUserInRealtimeDB: firebaseUser não fornecido.");
    return;
  }

  const userRef = ref(rtdb, `users/${firebaseUser.uid}`);
  
  const commonData = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    lastLoginAt: rtdbServerTimestamp(),
  };

  try {
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      const dataToCreate: UserDocument = {
        ...commonData,
        createdAt: rtdbServerTimestamp(),
      };
      await set(userRef, dataToCreate);
      console.log(`Novo usuário ${firebaseUser.uid} salvo no Realtime Database.`);
    } else {
      await update(userRef, commonData);
      console.log(`Dados do usuário ${firebaseUser.uid} atualizados no Realtime Database.`);
    }
  } catch (error: any) {
    console.error("Erro ao salvar/atualizar usuário no Realtime Database:");
    if (error.code) console.error("  Código do Erro:", error.code);
    if (error.message) console.error("  Mensagem:", error.message);
    // throw error; // Considere relançar ou tratar de forma mais específica
  }
};

export interface NewTransactionData {
  type: TransactionType;
  amount: number;
  category:string;
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
    const userPathRef = ref(rtdb, `users/${userId}`); // Renomeado para clareza
    const userSnapshot = await get(userPathRef);

    if (!userSnapshot.exists()) {
      console.error(`Caminho do usuário users/${userId} não existe no RTDB. Não é possível adicionar transação.`);
      return { success: false, error: "Perfil de usuário não encontrado. Não é possível adicionar transação." };
    }

    const transactionsRef = ref(rtdb, `users/${userId}/transactions`);
    const newTransactionRef = push(transactionsRef); // Gera um ID único
    
    await set(newTransactionRef, {
      ...transactionData,
      createdAt: rtdbServerTimestamp(),
    });
    console.log(`Transação ${newTransactionRef.key} adicionada para o usuário ${userId}.`);
    return { success: true, transactionId: newTransactionRef.key || undefined };
  } catch (error: any) { 
    console.error("Erro ao adicionar transação ao Realtime Database:");
    if (error.code) console.error("  Código do Erro:", error.code);
    if (error.message) console.error("  Mensagem:", error.message);
    return { success: false, error: "Ocorreu um erro ao adicionar a transação. Verifique os logs do servidor." };
  }
};
