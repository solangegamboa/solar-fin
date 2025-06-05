
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
import { Checkbox } from '@/components/ui/checkbox';
import { addTransaction, type NewTransactionData, type AddTransactionResult, getCategoriesForUser, addCategoryForUser } from '@/lib/databaseService';
import { useToast } from '@/hooks/use-toast';
import { Sun } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect, useCallback } from 'react';
import type { UserCategory } from '@/types';
import { Combobox } from '@/components/ui/combobox';
import { useAuth } from '@/contexts/AuthContext';


const transactionFormSchema = z.object({
  type: z.enum(['income', 'expense'], {
    required_error: 'O tipo da transação é obrigatório.',
  }),
  amount: z.coerce
    .number({ invalid_type_error: 'O valor deve ser um número.' , required_error: 'O valor é obrigatório.'})
    .positive({ message: 'O valor deve ser positivo.' })
    .min(0.01, { message: 'O valor deve ser maior que zero.' }),
  category: z.string().min(1, { message: 'A categoria é obrigatória.' }).max(50, { message: 'A categoria deve ter no máximo 50 caracteres.'}),
  date: z.date({
    required_error: 'A data da transação é obrigatória.',
  }),
  description: z.string().max(200, { message: 'A descrição deve ter no máximo 200 caracteres.'}).optional(),
  isRecurring: z.boolean().optional(),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

interface TransactionFormProps {
  onSuccess?: () => void;
  setOpen: (open: boolean) => void;
  userId: string; 
}

export function TransactionForm({ onSuccess, setOpen, userId }: TransactionFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  const fetchCategories = useCallback(async () => {
    if (!userId) return;
    setIsLoadingCategories(true);
    try {
      const userCategories = await getCategoriesForUser(userId);
      setCategories(userCategories);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar as categorias." });
    } finally {
      setIsLoadingCategories(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      type: undefined,
      amount: '' as unknown as number,
      category: '',
      date: new Date(),
      description: '',
      isRecurring: false,
    },
  });

  const handleAddNewCategory = async (categoryName: string): Promise<UserCategory | null> => {
    if (!userId) {
      toast({ variant: "destructive", title: "Erro", description: "Usuário não identificado." });
      return null;
    }
    const result = await addCategoryForUser(userId, categoryName);
    if (result.success && result.category) {
      // Add to local state to update Combobox immediately
      setCategories(prev => [...prev, result.category!].sort((a, b) => a.name.localeCompare(b.name)));
      return result.category;
    } else {
      toast({ variant: "destructive", title: "Erro ao Adicionar Categoria", description: result.error || "Não foi possível salvar a nova categoria." });
      return null;
    }
  };

  const onSubmit = async (values: TransactionFormValues) => {
    setIsSubmitting(true);

    const transactionData: NewTransactionData = {
      ...values,
      date: format(values.date, 'yyyy-MM-dd'),
      amount: Number(values.amount),
      isRecurring: values.isRecurring || false,
    };

    try {
      const result: AddTransactionResult = await addTransaction(userId, transactionData);

      if (result.success && result.transactionId) {
        toast({
          title: 'Sucesso!',
          description: `Transação adicionada com sucesso.`,
        });
        form.reset({ 
            type: undefined, 
            amount: '' as unknown as number, 
            category: '', 
            date: new Date(), 
            description: '', 
            isRecurring: false 
        });
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
      const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
      console.error('Client-side error calling addTransaction:', errorMessage);
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
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
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
                <Input type="number" placeholder="0.00" {...field} step="0.01" disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Categoria</FormLabel>
                <Combobox
                    items={categories}
                    value={field.value}
                    onChange={field.onChange}
                    onAddNewCategory={handleAddNewCategory}
                    placeholder="Selecione ou crie uma categoria"
                    searchPlaceholder="Buscar ou criar nova..."
                    emptyMessage={isLoadingCategories ? "Carregando categorias..." : "Nenhuma categoria. Digite para criar."}
                    disabled={isSubmitting || isLoadingCategories || !user}
                />
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
                <DatePicker value={field.value} onChange={field.onChange} disabled={isSubmitting} />
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
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isRecurring"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="font-normal">
                  Transação Recorrente?
                </FormLabel>
              </div>
            </FormItem>
          )}
        />


        <div className="flex justify-end space-x-2 pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || isLoadingCategories || !user}>
            {isSubmitting || isLoadingCategories ? (
              <>
                <Sun className="mr-2 h-4 w-4 animate-spin" />
                {isLoadingCategories ? 'Carregando...' : 'Salvando...'}
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
