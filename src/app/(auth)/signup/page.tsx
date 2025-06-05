
'use client';

import { AuthForm } from '@/components/auth/AuthForm';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { upsertUserInFirestore } from '@/lib/firestoreService'; // O nome da função é mantido, mas a implementação usa RTDB

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleSignup = async (values: { email: string; password: string }) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      if (userCredential.user) {
        await upsertUserInFirestore(userCredential.user); // Salva/Atualiza no RTDB
      }
      toast({ title: "Conta criada com sucesso!", description: "Redirecionando para o painel..." });
      router.push('/dashboard');
    } catch (error: any) {
      let message = "Ocorreu um erro ao tentar criar a conta. Tente novamente.";
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          message = "Este email já está em uso por outra conta.";
          break;
        case 'auth/weak-password':
          message = "A senha é muito fraca. Por favor, use uma senha mais forte.";
          break;
        case 'auth/operation-not-allowed':
          message = "Cadastro com email e senha não está habilitado. Contate o suporte.";
          break;
        case 'auth/invalid-email':
          message = "O formato do email é inválido.";
          break;
        case 'auth/network-request-failed':
          message = "Erro de rede. Verifique sua conexão e tente novamente.";
          break;
        default:
          if (error.code && error.message) {
            console.error("Firebase signup error (unhandled code):", error.code, error.message);
          } else {
            console.error("Firebase signup error (generic):", error); 
          }
          break;
      }

      console.error("Firebase signup error details:", error.code, error.message);
      throw new Error(message); 
    }
  };

  return <AuthForm mode="signup" onSubmit={handleSignup} />;
}
