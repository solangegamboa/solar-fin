
'use client';

import { AuthForm } from '@/components/auth/AuthForm';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { upsertUserInFirestore } from '@/lib/firestoreService';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (values: { email: string; password: string }) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      if (userCredential.user) {
        await upsertUserInFirestore(userCredential.user);
      }
      toast({ title: "Login bem-sucedido!", description: "Redirecionando para o painel..." });
      router.push('/dashboard');
    } catch (error: any) {
      let message = "Ocorreu um erro ao tentar fazer login. Tente novamente.";
      
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          message = "Email ou senha inválidos.";
          break;
        case 'auth/user-disabled':
          message = "Esta conta de usuário foi desabilitada.";
          break;
        case 'auth/too-many-requests':
          message = "Acesso bloqueado temporariamente devido a muitas tentativas. Tente novamente mais tarde.";
          break;
        case 'auth/operation-not-allowed':
          message = "Login com email e senha não está habilitado. Contate o suporte.";
          break;
        case 'auth/network-request-failed':
          message = "Erro de rede. Verifique sua conexão e tente novamente.";
          break;
        default:
          // message remains the generic one for the user
          // Log the specific Firebase error for debugging, if available
          if (error.code && error.message) {
            console.error("Firebase login error (unhandled code):", error.code, error.message);
          } else {
            console.error("Firebase login error (generic):", error); // Fallback if code/message are not present
          }
          break;
      }
      
      // Log only safe properties to avoid call stack errors from complex error objects
      console.error("Firebase login error details:", error.code, error.message);
      throw new Error(message); // This will be caught by AuthForm
    }
  };

  return <AuthForm mode="login" onSubmit={handleLogin} />;
}
