
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import Logo from '@/components/core/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { Sun } from 'lucide-react';

const signupSchema = z.object({
  displayName: z.string().optional(),
  email: z.string().email({ message: 'Por favor, insira um email válido.' }),
  password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { signup, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  const onSubmit = async (values: SignupFormValues) => {
    setIsSubmitting(true);
    const result = await signup(values.email, values.password, values.displayName);
    setIsSubmitting(false);
    if (result.success) {
      router.push('/dashboard');
    }
    // Error toast is handled by AuthContext
  };

  return (
    <div className="space-y-6 p-6 sm:p-8 rounded-lg shadow-xl border bg-card">
      <div className="flex flex-col items-center space-y-2 text-center">
        <Logo className="h-12 w-12 sm:h-16 sm:w-16" />
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight font-headline">
          Crie sua Conta
        </h1>
        <p className="text-sm text-muted-foreground">
          Comece a organizar suas finanças hoje mesmo.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome (Opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Seu nome" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="seu@email.com" {...field} />
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
                  <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isSubmitting || authLoading}>
            {isSubmitting || authLoading ? <Sun className="mr-2 h-4 w-4 animate-spin" /> : null}
            Criar Conta
          </Button>
        </form>
      </Form>
      <p className="text-center text-sm text-muted-foreground">
        Já tem uma conta?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Faça login
        </Link>
      </p>
    </div>
  );
}
