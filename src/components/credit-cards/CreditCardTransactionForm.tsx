
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
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { addCreditCardPurchase, type AddCreditCardPurchaseResult } from '@/lib/databaseService';
import type { CreditCard, NewCreditCardPurchaseData } from '@/types';
import { format } from 'date-fns';

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
  userId: string; // Added userId prop
}

export function CreditCardTransactionForm({
  userCreditCards,
  onSuccess,
  setOpen,
  userId, // Destructure userId
}: CreditCardTransactionFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const onSubmit = async (values: PurchaseFormValues) => {
    setIsSubmitting(true);

    const purchaseData: NewCreditCardPurchaseData = {
      ...values,
      date: format(values.date, 'yyyy-MM-dd'), 
    };

    try {
      // Pass userId to addCreditCardPurchase
      const result: AddCreditCardPurchaseResult = await addCreditCardPurchase(userId, purchaseData);

      if (result.success && result.purchaseId) {
        toast({
          title: 'Sucesso!',
          description: 'Compra no cartão de crédito adicionada.',
        });
        form.reset();
        if (onSuccess) onSuccess();
        setOpen(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao Adicionar Compra',
          description: result.error || 'Ocorreu um erro desconhecido.',
        });
      }
    } catch (error: any) {
      const errorMessage = (error && typeof error.message === 'string') ? error.message : 'Ocorreu um erro ao salvar a compra.';
      console.error('Client-side error calling addCreditCardPurchase:', errorMessage);
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cartão" />
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
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Compra Online Amazon" {...field} />
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
                <Input placeholder="Ex: Eletrônicos, Supermercado" {...field} />
              </FormControl>
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
                  <Input type="number" placeholder="300.00" {...field} step="0.01" />
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
                  <Input type="number" placeholder="1" {...field} min="1" max="24"/>
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
          <Button type="submit" disabled={isSubmitting || userCreditCards.length === 0}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Compra'
            )}
          </Button>
        </div>
         {userCreditCards.length === 0 && (
          <p className="text-sm text-destructive text-center">Adicione um cartão de crédito antes de registrar uma compra.</p>
        )}
      </form>
    </Form>
  );
}
