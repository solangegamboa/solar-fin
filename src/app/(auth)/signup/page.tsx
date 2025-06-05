
'use client';

import { AuthForm } from '@/components/auth/AuthForm';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { upsertUserInFirestore } from '@/lib/firestoreService';

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleSignup = async (values: { email: string; password: string }) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      if (userCredential.user) {
        await upsertUserInFirestore(userCredential.user);
      }
      toast({ title: "Conta criada com sucesso!", description: "Redirecionando para o painel..." });
      router.push('/dashboard');
    } catch (error: any) {
      let message = "Ocorreu um erro ao tentar criar a conta.";
      if (error.code === 'auth/email-already-in-use') {
        message = "Este email já está em uso.";
      }
      console.error("Firebase signup error:", error);
      throw new Error(message); // This will be caught by AuthForm
    }
  };

  return <AuthForm mode="signup" onSubmit={handleSignup} />;
}
