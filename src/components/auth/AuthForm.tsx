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

const formSchema = z.object({
  email: z.string().email({ message: 'Por favor, insira um email válido.' }),
  password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
});

type AuthFormValues = z.infer<typeof formSchema>;

interface AuthFormProps {
  mode: 'login' | 'signup';
  onSubmit: (values: AuthFormValues) => Promise<void>;
}

export function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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
    } catch (error: any) {
       toast({
        variant: "destructive",
        title: "Erro de Autenticação",
        description: error.message || (mode === 'login' ? 'Falha ao entrar.' : 'Falha ao criar conta.'),
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
            ? 'Entre com seu email e senha.'
            : 'Preencha os campos para se registrar.'}
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
