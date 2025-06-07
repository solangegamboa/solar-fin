
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
import { Sun } from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react'; // Added useCallback, useMemo
import { addLoan, type NewLoanData, type UpdateLoanData } from '@/lib/databaseService';
import type { Loan } from '@/types';
import { format, parseISO, isValid as isValidDate } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

const loanFormSchema = z.object({
  bankName: z.string().min(1, { message: 'O nome do banco é obrigatório.' }).max(50, { message: 'Máximo de 50 caracteres.'}),
  description: z.string().min(1, { message: 'A descrição é obrigatória.' }).max(100, { message: 'Máximo de 100 caracteres.'}),
  installmentAmount: z.coerce
    .number({ invalid_type_error: 'O valor da parcela deve ser um número.', required_error: 'O valor da parcela é obrigatório.' })
    .positive({ message: 'O valor da parcela deve ser positivo.' })
    .min(0.01, { message: 'O valor deve ser maior que zero.' }),
  startDate: z.date({ required_error: 'A data de início é obrigatória.' }),
  installmentsCount: z.coerce
    .number({ invalid_type_error: 'A quantidade de parcelas deve ser um número.', required_error: 'A quantidade de parcelas é obrigatória.' })
    .int({ message: 'A quantidade de parcelas deve ser um número inteiro.' })
    .min(1, { message: 'A quantidade de parcelas deve ser no mínimo 1.' })
    .max(360, { message: 'A quantidade de parcelas não pode exceder 360 (30 anos).'})
});

type LoanFormValues = z.infer<typeof loanFormSchema>;

interface LoanFormProps {
  onSuccess?: () => void;
  setOpen: (open: boolean) => void;
  existingLoan?: Loan | null; 
  userId: string; 
}

export function LoanForm({ onSuccess, setOpen, existingLoan, userId }: LoanFormProps) {
  const { toast } = useToast();
  const { getToken } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoanFormValues>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: useMemo(() => (existingLoan ? {
        bankName: existingLoan.bankName,
        description: existingLoan.description,
        installmentAmount: existingLoan.installmentAmount,
        startDate: parseISO(existingLoan.startDate),
        installmentsCount: existingLoan.installmentsCount,
      } : {
      bankName: '',
      description: '',
      installmentAmount: undefined,
      startDate: new Date(),
      installmentsCount: undefined,
    }), [existingLoan]),
  });

  useEffect(() => {
    const startDateValue = existingLoan?.startDate ? parseISO(existingLoan.startDate) : new Date();
    const validStartDate = isValidDate(startDateValue) ? startDateValue : new Date();

    if (existingLoan) {
      form.reset({
        bankName: existingLoan.bankName,
        description: existingLoan.description,
        installmentAmount: existingLoan.installmentAmount,
        startDate: validStartDate,
        installmentsCount: existingLoan.installmentsCount,
      });
    } else {
      form.reset({
        bankName: '',
        description: '',
        installmentAmount: undefined,
        startDate: new Date(),
        installmentsCount: undefined,
      });
    }
  }, [existingLoan, form.reset]);


  const onSubmit = async (values: LoanFormValues) => {
    setIsSubmitting(true);
    const token = getToken();
    if (!token) {
      toast({ variant: 'destructive', title: 'Erro de Autenticação', description: 'Sessão inválida.' });
      setIsSubmitting(false);
      return;
    }
    
    const apiData: NewLoanData | UpdateLoanData = {
      bankName: values.bankName,
      description: values.description,
      installmentAmount: Number(values.installmentAmount),
      startDate: format(values.startDate, 'yyyy-MM-dd'),
      installmentsCount: Number(values.installmentsCount),
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    let response;
    let result;

    try {
      if (existingLoan) {
        response = await fetch(`/api/loans/${existingLoan.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(apiData),
        });
      } else {
        response = await fetch('/api/loans', {
          method: 'POST',
          headers,
          body: JSON.stringify(apiData),
        });
      }
      
      result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: 'Sucesso!',
          description: `Empréstimo ${existingLoan ? 'atualizado' : 'adicionado'} com sucesso.`,
        });
        form.reset({ 
          bankName: '',
          description: '',
          installmentAmount: undefined,
          startDate: new Date(),
          installmentsCount: undefined,
        });
        if (onSuccess) onSuccess();
        setOpen(false);
      } else {
        toast({
          variant: 'destructive',
          title: `Erro ao ${existingLoan ? 'Atualizar' : 'Adicionar'} Empréstimo`,
          description: result.message || 'Ocorreu um erro desconhecido.',
        });
      }
    } catch (error: any) {
      const errorMessage = (error && typeof error.message === 'string') ? error.message : 'Ocorreu um erro ao salvar o empréstimo.';
      console.error('Client-side error processing loan:', errorMessage);
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
                <Input placeholder="Ex: Banco do Brasil" {...field} disabled={isSubmitting}/>
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
                <Textarea placeholder="Ex: Financiamento Imobiliário Apto 123" {...field} disabled={isSubmitting}/>
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
                <Input
                  type="number"
                  step="0.01"
                  lang="pt-BR"
                  placeholder="R$ 500,00"
                  {...field}
                  value={field.value === undefined ? '' : field.value}
                  onChange={e => field.onChange(e.target.valueAsNumber === undefined || isNaN(e.target.valueAsNumber) ? null : e.target.valueAsNumber)}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => {
              // Memoize the onChange handler for the DatePicker
              const handleDateChange = useCallback((date: Date | undefined) => {
                const currentValue = field.value; // field.value is a Date object here
                if (
                  (date === undefined && currentValue !== undefined) ||
                  (date !== undefined && currentValue === undefined) ||
                  (date && currentValue && date.getTime() !== currentValue.getTime())
                ) {
                  // Use form.setValue for more control if direct field.onChange causes issues,
                  // but field.onChange is usually the correct RHF way.
                  // For this specific error, ensuring stability and minimal updates is key.
                  form.setValue('startDate', date as Date, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                }
              }, [field.value, form.setValue]); // form.setValue is stable

              return (
                <FormItem className="flex flex-col">
                  <FormLabel>Data de Início da Primeira Parcela</FormLabel>
                  <DatePicker 
                    value={field.value} 
                    onChange={handleDateChange} 
                    disabled={isSubmitting}
                  />
                  <FormMessage />
                </FormItem>
              );
            }}
          />
           <FormField
            control={form.control}
            name="installmentsCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantidade de Parcelas</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Ex: 12" {...field} min="1" disabled={isSubmitting}/>
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
                <Sun className="mr-2 h-4 w-4 animate-spin" />
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

