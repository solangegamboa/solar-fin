
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Sun } from 'lucide-react';
import { useState } from 'react';
import type { Investment, NewInvestmentData, UpdateInvestmentData, InvestmentType } from '@/types';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

const investmentTypes: { value: InvestmentType; label: string }[] = [
  { value: 'stock', label: 'Ações' },
  { value: 'savings', label: 'Poupança' },
  { value: 'crypto', label: 'Criptomoedas' },
  { value: 'other', label: 'Outro' },
];

const investmentFormSchema = z.object({
  name: z.string().min(1, 'O nome do investimento é obrigatório.').max(100, 'Máximo de 100 caracteres.'),
  type: z.enum(['stock', 'savings', 'crypto', 'other'], { required_error: 'O tipo é obrigatório.' }),
  currentValue: z.coerce
    .number({ invalid_type_error: 'Valor atual deve ser um número.' , required_error: 'O valor atual é obrigatório.'})
    .min(0, 'O valor atual não pode ser negativo.'), 
  initialAmount: z.coerce
    .number({ invalid_type_error: 'Valor inicial deve ser um número.' })
    .min(0, 'O valor inicial não pode ser negativo.')
    .optional().nullable(),
  quantity: z.coerce
    .number({ invalid_type_error: 'Quantidade deve ser um número.' })
    .min(0, 'A quantidade não pode ser negativa.')
    .optional().nullable(),
  symbol: z.string().max(20, 'Símbolo/Ticker muito longo.').optional().nullable(),
  institution: z.string().max(100, 'Nome da instituição muito longo.').optional().nullable(),
  acquisitionDate: z.date().optional().nullable(),
  notes: z.string().max(500, 'Observações muito longas.').optional().nullable(),
});

type InvestmentFormValues = z.infer<typeof investmentFormSchema>;

interface InvestmentFormProps {
  userId: string;
  existingInvestment?: Investment | null;
  onSuccess: (investment: Investment) => void;
  setOpen: (open: boolean) => void;
}

export function InvestmentForm({ userId, existingInvestment, onSuccess, setOpen }: InvestmentFormProps) {
  const { toast } = useToast();
  const { getToken } = useAuth(); // Get getToken from AuthContext
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultValues: Partial<InvestmentFormValues> = existingInvestment
    ? {
        ...existingInvestment,
        acquisitionDate: existingInvestment.acquisitionDate ? parseISO(existingInvestment.acquisitionDate) : null,
        currentValue: existingInvestment.currentValue || 0,
        initialAmount: existingInvestment.initialAmount || undefined, 
        quantity: existingInvestment.quantity || undefined,
      }
    : {
        name: '',
        type: undefined, 
        currentValue: undefined,
        initialAmount: undefined,
        quantity: undefined,
        acquisitionDate: null,
        symbol: '',
        institution: '',
        notes: '',
      };

  const form = useForm<InvestmentFormValues>({
    resolver: zodResolver(investmentFormSchema),
    defaultValues,
  });

  const onSubmit = async (values: InvestmentFormValues) => {
    setIsSubmitting(true);
    const token = getToken();
    if (!token) {
      toast({ variant: 'destructive', title: 'Erro de Autenticação', description: 'Sessão inválida.' });
      setIsSubmitting(false);
      return;
    }

    const apiData: NewInvestmentData | UpdateInvestmentData = {
      ...values,
      acquisitionDate: values.acquisitionDate ? format(values.acquisitionDate, 'yyyy-MM-dd') : null,
      currentValue: values.currentValue, 
      initialAmount: values.initialAmount != null ? values.initialAmount : null,
      quantity: values.quantity != null ? values.quantity : null,
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    try {
      let response;
      let result;

      if (existingInvestment) {
        response = await fetch(`/api/investments/${existingInvestment.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(apiData),
        });
        result = await response.json();
        if (response.ok && result.success) {
            onSuccess({ ...existingInvestment, ...values, acquisitionDate: apiData.acquisitionDate, updatedAt: Date.now() } as Investment);
        }
      } else {
        response = await fetch('/api/investments', {
          method: 'POST',
          headers,
          body: JSON.stringify(apiData),
        });
        result = await response.json();
         if (response.ok && result.success && result.investmentId) {
            const now = Date.now();
            onSuccess({
                id: result.investmentId,
                userId,
                ...values,
                currentValue: values.currentValue!,
                acquisitionDate: apiData.acquisitionDate,
                createdAt: now,
                updatedAt: now,
            } as Investment);
        }
      }

      if (response.ok && result.success) {
        toast({
          title: 'Sucesso!',
          description: `Investimento ${existingInvestment ? 'atualizado' : 'adicionado'} com sucesso.`,
        });
        setOpen(false);
      } else {
        toast({
          variant: 'destructive',
          title: `Erro ao ${existingInvestment ? 'atualizar' : 'adicionar'} investimento`,
          description: result.message || 'Ocorreu um erro.',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro de comunicação',
        description: error.message || 'Não foi possível conectar ao servidor.',
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
              <FormLabel>Nome do Investimento</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Ações Apple, Poupança Banco X" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Investimento</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {investmentTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="currentValue"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor Atual (R$)</FormLabel>
              <FormControl>
                <Input lang="pt-BR" type="number" placeholder="R$ 1.500,00" {...field} step="0.01" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="initialAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Inicial Investido (R$, Opcional)</FormLabel>
                <FormControl>
                  <Input lang="pt-BR" type="number" placeholder="R$ 1.000,00" {...field} value={field.value ?? ''} step="0.01" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantidade (Opcional)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Ex: 10 (ações), 0.5 (BTC)" {...field} value={field.value ?? ''} step="any" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <FormField
            control={form.control}
            name="symbol"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Símbolo/Ticker (Opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: AAPL, BTC" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="institution"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Instituição/Corretora (Opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: XP, Binance, Banco Inter" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="acquisitionDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Data de Aquisição (Opcional)</FormLabel>
              <DatePicker value={field.value || undefined} onChange={field.onChange} />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações (Opcional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Detalhes adicionais sobre o investimento..." {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
              existingInvestment ? 'Salvar Alterações' : 'Adicionar Investimento'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
