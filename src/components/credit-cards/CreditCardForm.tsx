
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
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { addCreditCard, type NewCreditCardData, type AddCreditCardResult } from '@/lib/databaseService';

const creditCardFormSchema = z.object({
  name: z.string().min(1, { message: 'O nome do cartão é obrigatório.' }).max(50, {message: 'O nome do cartão deve ter no máximo 50 caracteres.'}),
  limit: z.coerce
    .number({ invalid_type_error: 'O limite deve ser um número.', required_error: 'O limite é obrigatório.' })
    .positive({ message: 'O limite deve ser positivo.' })
    .min(1, { message: 'O limite deve ser maior que zero.' }),
  dueDateDay: z.coerce
    .number({ invalid_type_error: 'O dia de vencimento deve ser um número.', required_error: 'O dia de vencimento é obrigatório.' })
    .int({ message: 'O dia de vencimento deve ser um número inteiro.' })
    .min(1, { message: 'O dia de vencimento deve ser entre 1 e 31.' })
    .max(31, { message: 'O dia de vencimento deve ser entre 1 e 31.' }),
  closingDateDay: z.coerce
    .number({ invalid_type_error: 'O dia de fechamento deve ser um número.', required_error: 'O dia de fechamento é obrigatório.' })
    .int({ message: 'O dia de fechamento deve ser um número inteiro.' })
    .min(1, { message: 'O dia de fechamento deve ser entre 1 e 31.' })
    .max(31, { message: 'O dia de fechamento deve ser entre 1 e 31.' }),
});

type CreditCardFormValues = z.infer<typeof creditCardFormSchema>;

interface CreditCardFormProps {
  onSuccess?: () => void;
  setOpen: (open: boolean) => void;
  userId: string; // Added userId prop
}

export function CreditCardForm({ onSuccess, setOpen, userId }: CreditCardFormProps) {
  const { toast } } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreditCardFormValues>({
    resolver: zodResolver(creditCardFormSchema),
    defaultValues: {
      name: '',
      limit: '' as unknown as number,
      dueDateDay: '' as unknown as number,
      closingDateDay: '' as unknown as number,
    },
  });

  const onSubmit = async (values: CreditCardFormValues) => {
    setIsSubmitting(true);

    const creditCardData: NewCreditCardData = {
      ...values,
    };

    try {
      // Pass userId to addCreditCard
      const result: AddCreditCardResult = await addCreditCard(userId, creditCardData);

      if (result.success && result.creditCardId) {
        toast({
          title: 'Sucesso!',
          description: 'Cartão de crédito adicionado com sucesso.',
        });
        form.reset();
        if (onSuccess) onSuccess();
        setOpen(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao Adicionar Cartão',
          description: result.error || 'Ocorreu um erro desconhecido.',
        });
      }
    } catch (error: any) {
      const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
      console.error('Client-side error calling addCreditCard:', errorMessage);
      toast({
        variant: 'destructive',
        title: 'Erro de Comunicação',
        description: 'Ocorreu um erro ao salvar o cartão. Tente novamente.',
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Cartão</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Nubank Ultravioleta" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="limit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Limite (R$)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="5000.00" {...field} step="0.01" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="dueDateDay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dia do Vencimento</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Ex: 10" {...field} min="1" max="31" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="closingDateDay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dia do Fechamento</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Ex: 1" {...field} min="1" max="31"/>
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
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Cartão'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
