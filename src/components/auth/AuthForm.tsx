
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/core/Logo';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { upsertUserInFirestore } from '@/lib/firestoreService';

const formSchema = z.object({
  email: z.string().email({ message: 'Por favor, insira um email válido.' }),
  password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
});

type AuthFormValues = z.infer<typeof formSchema>;

interface AuthFormProps {
  mode: 'login' | 'signup';
  onSubmit: (values: AuthFormValues) => Promise<void>;
}

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
  </svg>
);


export function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleSubmit = async (values: AuthFormValues) => {
    setLoading(true);
    try {
      await onSubmit(values);
      // upsertUserInFirestore será chamado dentro de onSubmit (nas páginas login/signup)
    } catch (error: any) {
       toast({
        variant: "destructive",
        title: "Erro de Autenticação",
        description: (mode === 'login' ? 'Falha ao entrar. Verifique suas credenciais e tente novamente.' : 'Falha ao criar conta. Por favor, tente novamente.'),
      });
      console.error("AuthForm submission error:", error.message ? error.message : String(error)); 
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(auth, provider);
      if (userCredential.user) {
        await upsertUserInFirestore(userCredential.user);
      }
      toast({ title: "Login com Google bem-sucedido!", description: "Redirecionando para o painel..." });
      router.push('/dashboard');
    } catch (error: any) {
      let message = "Ocorreu um erro ao tentar fazer login com o Google.";
      if (error.code === 'auth/account-exists-with-different-credential') {
        message = "Já existe uma conta com este email usando um método de login diferente.";
      } else if (error.code === 'auth/popup-closed-by-user') {
        message = "Login com Google cancelado.";
      }
      // Log only safe properties for Google sign-in errors as well
      console.error("Firebase Google sign-in error:", error.code, error.message);
      toast({
        variant: "destructive",
        title: "Erro de Autenticação com Google",
        description: message, 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-8 rounded-lg shadow-xl border bg-card">
      <div className="flex flex-col items-center space-y-2">
        <Logo className="h-16 w-16" />
        <h1 className="text-2xl font-semibold tracking-tight font-headline">
          {mode === 'login' ? 'Bem-vindo de volta!' : 'Crie sua conta'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === 'login'
            ? 'Entre com seu email e senha ou use o Google.'
            : 'Preencha os campos para se registrar ou use o Google.'}
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="seu@email.com" {...field} type="email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Senha</FormLabel>
                <FormControl>
                  <Input placeholder="********" {...field} type="password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (mode === 'login' ? 'Entrando...' : 'Criando conta...') : (mode === 'login' ? 'Entrar' : 'Criar Conta')}
          </Button>
        </form>
      </Form>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            Ou continue com
          </span>
        </div>
      </div>

      <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>
        {loading ? 'Carregando...' : (
          <>
            <GoogleIcon />
            <span className="ml-2">Entrar com Google</span>
          </>
        )}
      </Button>

      <div className="text-center text-sm">
        {mode === 'login' ? (
          <>
            Não tem uma conta?{' '}
            <Link href="/signup" className="underline text-primary hover:text-primary/80">
              Cadastre-se
            </Link>
          </>
        ) : (
          <>
            Já tem uma conta?{' '}
            <Link href="/login" className="underline text-primary hover:text-primary/80">
              Entre
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
