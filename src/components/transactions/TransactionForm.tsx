
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { useAuth } from '@/contexts/AuthContext';
import { addTransaction, type NewTransactionData, type AddTransactionResult } from '@/lib/firestoreService'; // O nome da função é mantido, mas a implementação usa RTDB
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

const transactionFormSchema = z.object({
  type: z.enum(['income', 'expense'], {
    required_error: 'O tipo da transação é obrigatório.',
  }),
  amount: z.coerce
    .number({ invalid_type_error: 'O valor deve ser um número.' })
    .positive({ message: 'O valor deve ser positivo.' })
    .min(0.01, { message: 'O valor deve ser maior que zero.' }),
  category: z.string().min(1, { message: 'A categoria é obrigatória.' }).max(50, { message: 'A categoria deve ter no máximo 50 caracteres.'}),
  date: z.date({
    required_error: 'A data da transação é obrigatória.',
  }),
  description: z.string().max(200, { message: 'A descrição deve ter no máximo 200 caracteres.'}).optional(),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

interface TransactionFormProps {
  onSuccess?: () => void; 
  setOpen: (open: boolean) => void; 
}

export function TransactionForm({ onSuccess, setOpen }: TransactionFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      type: undefined, 
      amount: '' as unknown as number, 
      category: '',
      date: new Date(),
      description: '',
    },
  });

  const onSubmit = async (values: TransactionFormValues) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Erro de Autenticação',
        description: 'Você precisa estar logado para adicionar uma transação.',
      });
      return;
    }

    setIsSubmitting(true);

    const transactionData: NewTransactionData = {
      ...values,
      date: format(values.date, 'yyyy-MM-dd'), 
      amount: Number(values.amount) 
    };

    try {
      const result: AddTransactionResult = await addTransaction(user.uid, transactionData); // Salva no RTDB

      if (result.success && result.transactionId) {
        toast({
          title: 'Sucesso!',
          description: `Transação adicionada com sucesso.`,
        });
        form.reset();
        if (onSuccess) onSuccess();
        setOpen(false); 
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao Adicionar Transação',
          description: result.error || 'Ocorreu um erro desconhecido.',
        });
      }
    } catch (error: any) { 
      console.error('Client-side error calling addTransaction:', error); 
      const displayMessage = 'Ocorreu um erro ao salvar a transação. Tente novamente.';
      toast({
        variant: 'destructive',
        title: 'Erro de Comunicação',
        description: displayMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo da transação" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor (R$)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0.00" {...field} step="0.01" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Alimentação, Salário" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Data</FormLabel>
                <DatePicker value={field.value} onChange={field.onChange} />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição (Opcional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Adicione uma breve descrição..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Transação'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
