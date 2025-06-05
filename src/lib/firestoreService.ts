
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
  
  // Dados que são comuns para criação e atualização.
  // lastLoginAt é sempre atualizado.
  const commonData = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL, // Pode ser null, o que é ok.
    lastLoginAt: serverTimestamp(),
  };

  try {
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // Novo usuário no Firestore: adiciona createdAt e cria o documento.
      // Este é o ponto onde o "path" do documento do usuário é criado se não existir.
      const dataToCreate: UserDocument = {
        ...commonData,
        createdAt: serverTimestamp(),
      };
      await setDoc(userRef, dataToCreate);
      console.log(`Novo usuário ${firebaseUser.uid} salvo no Firestore.`);
    } else {
      // Usuário existente: atualiza com commonData.
      // A opção { merge: true } garante que outros campos (como createdAt) sejam preservados.
      await setDoc(userRef, commonData, { merge: true });
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
    // Verifica se o documento do usuário pai existe antes de adicionar uma transação na subcoleção.
    // A função upsertUserInFirestore deve garantir que o documento do usuário seja criado no login/signup.
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      console.error(`Documento do usuário ${userId} não existe. Não é possível adicionar transação.`);
      return { success: false, error: "Perfil de usuário não encontrado. Não é possível adicionar transação." };
    }

    const transactionsCollectionRef = collection(db, 'users', userId, 'transactions');
    const docRef = await addDoc(transactionsCollectionRef, {
      ...transactionData,
      createdAt: serverTimestamp(),
    });
    return { success: true, transactionId: docRef.id };
  } catch (error: any) { 
    console.error("Error adding transaction to Firestore:", error); // Server-side log
    // Retorna uma mensagem de erro genérica e segura para o cliente.
    return { success: false, error: "Ocorreu um erro ao adicionar a transação. Por favor, tente novamente." };
  }
};
