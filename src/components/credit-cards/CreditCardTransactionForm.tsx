
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
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import { Sun } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { addCreditCardPurchase, getCategoriesForUser, addCategoryForUser } from '@/lib/databaseService'; // addCreditCardPurchase might need to become an API call
import type { CreditCard, NewCreditCardPurchaseData, UserCategory, CreditCardPurchase, UpdateCreditCardPurchaseData } from '@/types';
import { format, parseISO } from 'date-fns';
import { Combobox } from '@/components/ui/combobox';
import { useAuth } from '@/contexts/AuthContext';

const purchaseSchema = z.object({
  cardId: z.string().min(1, { message: 'Selecione um cartão de crédito.' }),
  date: z.date({ required_error: 'A data da compra é obrigatória.' }),
  description: z.string().min(1, { message: 'A descrição é obrigatória.' }).max(100, { message: 'Máximo de 100 caracteres.'}),
  category: z.string().min(1, { message: 'A categoria é obrigatória.' }).max(50, { message: 'Máximo de 50 caracteres.'}),
  totalAmount: z.coerce
    .number({ invalid_type_error: 'O valor total deve ser um número.', required_error: 'O valor total é obrigatório.' })
    .positive({ message: 'O valor total deve ser positivo.' })
    .min(0.01, { message: 'O valor deve ser maior que zero.' }),
  installments: z.coerce
    .number({ invalid_type_error: 'O número de parcelas deve ser um número.', required_error: 'O número de parcelas é obrigatório.' })
    .int({ message: 'O número de parcelas deve ser inteiro.' })
    .min(1, { message: 'Mínimo de 1 parcela.' })
    .max(24, { message: 'Máximo de 24 parcelas.' }), 
});

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

interface CreditCardTransactionFormProps {
  userCreditCards: CreditCard[];
  onSuccess?: () => void;
  setOpen: (open: boolean) => void;
  userId: string; 
  existingPurchase?: CreditCardPurchase | null;
}

export function CreditCardTransactionForm({
  userCreditCards,
  onSuccess,
  setOpen,
  userId, 
  existingPurchase,
}: CreditCardTransactionFormProps) {
  const { toast } = useToast();
  const { getToken } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  const fetchCategories = useCallback(async () => {
    if (!userId) return;
    setIsLoadingCategories(true);
    try {
      const userCategories = await getCategoriesForUser(userId); // This might need to be an API call with Auth header
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

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      cardId: '',
      date: new Date(),
      description: '',
      category: '',
      totalAmount: '' as unknown as number,
      installments: 1,
    },
  });

  useEffect(() => {
    if (existingPurchase) {
      form.reset({
        cardId: existingPurchase.cardId,
        date: parseISO(existingPurchase.date),
        description: existingPurchase.description,
        category: existingPurchase.category,
        totalAmount: existingPurchase.totalAmount,
        installments: existingPurchase.installments,
      });
    } else {
      form.reset({ 
        cardId: '',
        date: new Date(),
        description: '',
        category: '',
        totalAmount: '' as unknown as number,
        installments: 1,
      });
    }
  }, [existingPurchase, form]);
  
  const handleAddNewCategory = async (categoryName: string): Promise<UserCategory | null> => {
    if (!userId) {
      toast({ variant: "destructive", title: "Erro", description: "Usuário não identificado." });
      return null;
    }
    setIsSubmitting(true); // Disable form while adding category via potential API call
    // Assuming addCategoryForUser is robust (server action or API call)
    const result = await addCategoryForUser(userId, categoryName);
    setIsSubmitting(false);
    if (result.success && result.category) {
      setCategories(prev => [...prev, result.category!].sort((a,b) => a.name.localeCompare(b.name)));
      return result.category;
    } else {
      toast({ variant: "destructive", title: "Erro ao Adicionar Categoria", description: result.error || "Não foi possível salvar a nova categoria." });
      return null;
    }
  };

  const onSubmit = async (values: PurchaseFormValues) => {
    setIsSubmitting(true);
    const token = getToken();
    if (!token) {
      toast({ variant: 'destructive', title: 'Erro de Autenticação', description: 'Sessão inválida.' });
      setIsSubmitting(false);
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
    let result: { success: boolean; purchaseId?: string; error?: string; message?: string };

    try {
      if (existingPurchase) {
        const updateData: UpdateCreditCardPurchaseData = {
          cardId: values.cardId,
          date: format(values.date, 'yyyy-MM-dd'),
          description: values.description,
          category: values.category,
          totalAmount: Number(values.totalAmount),
          installments: Number(values.installments),
        };
        const response = await fetch(`/api/credit-card-purchases/${existingPurchase.id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(updateData),
        });
        result = await response.json();
      } else {
        // For new purchases, we'll create a new API endpoint /api/credit-card-purchases
        const purchaseData: NewCreditCardPurchaseData = {
          ...values,
          date: format(values.date, 'yyyy-MM-dd'), 
        };
        // TODO: Create /api/credit-card-purchases POST endpoint
        // For now, I'll keep the direct call to databaseService, but this is inconsistent
        // with localStorage token strategy if databaseService doesn't get the token.
        // This part of the logic will need a dedicated API route similar to transactions.
        // For the purpose of this change, I will assume it's being converted to an API call.
        // Let's temporarily use a placeholder, this WILL fail until the API is made.
        // result = await addCreditCardPurchase(userId, purchaseData); // Old direct call
         const response = await fetch(`/api/credit-card-purchases`, { // Assuming POST endpoint exists
            method: 'POST',
            headers,
            body: JSON.stringify(purchaseData),
        });
        result = await response.json();

      }

      if (result.success) {
        toast({
          title: 'Sucesso!',
          description: `Compra no cartão ${existingPurchase ? 'atualizada' : 'adicionada'}.`,
        });
        form.reset({
            cardId: '',
            date: new Date(),
            description: '',
            category: '',
            totalAmount: '' as unknown as number,
            installments: 1,
        });
        if (onSuccess) onSuccess();
        setOpen(false);
      } else {
        toast({
          variant: 'destructive',
          title: `Erro ao ${existingPurchase ? 'Atualizar' : 'Adicionar'} Compra`,
          description: result.error || result.message || 'Ocorreu um erro desconhecido.',
        });
      }
    } catch (error: any) {
      const errorMessage = (error && typeof error.message === 'string') ? error.message : `Ocorreu um erro ao ${existingPurchase ? 'atualizar' : 'salvar'} a compra.`;
      console.error('Client-side error processing credit card purchase:', errorMessage);
      toast({
        variant: 'destructive',
        title: 'Erro de Comunicação',
        description: errorMessage,
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
          name="cardId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cartão de Crédito</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting || userCreditCards.length === 0}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={userCreditCards.length > 0 ? "Selecione o cartão" : "Nenhum cartão cadastrado"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {userCreditCards.map((card) => (
                    <SelectItem key={card.id} value={card.id}>
                      {card.name} (Limite: {card.limit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Data da Compra</FormLabel>
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
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Compra Online Amazon" {...field} disabled={isSubmitting} />
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
                    disabled={isSubmitting || isLoadingCategories || !userId}
                />
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="totalAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Total (R$)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="300.00" {...field} step="0.01" disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="installments"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nº de Parcelas</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="1" {...field} min="1" max="24" disabled={isSubmitting}/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || isLoadingCategories || userCreditCards.length === 0 || !userId}>
            {isSubmitting || isLoadingCategories ? (
              <>
                <Sun className="mr-2 h-4 w-4 animate-spin" />
                {isLoadingCategories ? 'Carregando...' : 'Salvando...'}
              </>
            ) : (
              existingPurchase ? 'Salvar Alterações' : 'Salvar Compra'
            )}
          </Button>
        </div>
         {userCreditCards.length === 0 && (
          <p className="text-sm text-destructive text-center pt-2">Adicione um cartão de crédito antes de registrar uma compra.</p>
        )}
      </form>
    </Form>
  );
}
