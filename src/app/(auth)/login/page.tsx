
'use client';

import { AuthForm } from '@/components/auth/AuthForm';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { upsertUserInFirestore } from '@/lib/firestoreService'; // O nome da função é mantido, mas a implementação usa RTDB

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (values: { email: string; password: string }) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      if (userCredential.user) {
        await upsertUserInFirestore(userCredential.user); // Salva/Atualiza no RTDB
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
          if (error.code && error.message) {
            console.error("Firebase login error (unhandled code):", error.code, error.message);
          } else {
            console.error("Firebase login error (generic):", error); 
          }
          break;
      }
      
      console.error("Firebase login error details:", error.code, error.message);
      throw new Error(message); 
    }
  };

  return <AuthForm mode="login" onSubmit={handleLogin} />;
}
