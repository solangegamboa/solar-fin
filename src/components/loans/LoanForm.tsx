
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
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { addLoan, type NewLoanData } from '@/lib/databaseService';
import type { Loan } from '@/types';
import { format, parseISO } from 'date-fns';

const loanFormSchema = z.object({
  bankName: z.string().min(1, { message: 'O nome do banco é obrigatório.' }).max(50, { message: 'Máximo de 50 caracteres.'}),
  description: z.string().min(1, { message: 'A descrição é obrigatória.' }).max(100, { message: 'Máximo de 100 caracteres.'}),
  installmentAmount: z.coerce
    .number({ invalid_type_error: 'O valor da parcela deve ser um número.', required_error: 'O valor da parcela é obrigatório.' })
    .positive({ message: 'O valor da parcela deve ser positivo.' })
    .min(0.01, { message: 'O valor deve ser maior que zero.' }),
  startDate: z.date({ required_error: 'A data de início é obrigatória.' }),
  endDate: z.date({ required_error: 'A data de término é obrigatória.' }),
}).refine(data => data.endDate >= data.startDate, {
  message: "A data de término não pode ser anterior à data de início.",
  path: ["endDate"], 
});

type LoanFormValues = z.infer<typeof loanFormSchema>;

interface LoanFormProps {
  onSuccess?: () => void;
  setOpen: (open: boolean) => void;
  existingLoan?: Loan | null; 
}

export function LoanForm({ onSuccess, setOpen, existingLoan }: LoanFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoanFormValues>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: existingLoan ? {
        ...existingLoan,
        startDate: parseISO(existingLoan.startDate),
        endDate: parseISO(existingLoan.endDate),
        installmentAmount: existingLoan.installmentAmount || '' as unknown as number,
      } : {
      bankName: '',
      description: '',
      installmentAmount: '' as unknown as number,
      startDate: new Date(),
      endDate: new Date(),
    },
  });

  const onSubmit = async (values: LoanFormValues) => {
    setIsSubmitting(true);

    const loanData: NewLoanData = {
      ...values,
      startDate: format(values.startDate, 'yyyy-MM-dd'),
      endDate: format(values.endDate, 'yyyy-MM-dd'),
      installmentAmount: Number(values.installmentAmount),
    };

    try {
      // For now, only adding is implemented. Editing would require an updateLoan function.
      // if (existingLoan) {
      // Call updateLoan if it existed
      // } else {
      const result = await addLoan(loanData);
      if (result.success && result.loanId) {
        toast({
          title: 'Sucesso!',
          description: 'Empréstimo adicionado com sucesso.',
        });
        form.reset();
        if (onSuccess) onSuccess();
        setOpen(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao Adicionar Empréstimo',
          description: result.error || 'Ocorreu um erro desconhecido.',
        });
      }
      // }
    } catch (error: any) {
      const errorMessage = (error && typeof error.message === 'string') ? error.message : 'Ocorreu um erro ao salvar o empréstimo.';
      console.error('Client-side error calling addLoan:', errorMessage);
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
          name="bankName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Banco/Instituição</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Banco do Brasil" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição do Empréstimo</FormLabel>
              <FormControl>
                <Textarea placeholder="Ex: Financiamento Imobiliário Apto 123" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="installmentAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor da Parcela (R$)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="500.00" {...field} step="0.01" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Data de Início</FormLabel>
                <DatePicker value={field.value} onChange={field.onChange} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Data de Término</FormLabel>
                <DatePicker value={field.value} onChange={field.onChange} />
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
              existingLoan ? 'Salvar Alterações' : 'Salvar Empréstimo'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
