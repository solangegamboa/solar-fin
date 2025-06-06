
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
import { Sun, PiggyBank, Target, TrendingUp, Flag, XCircle } from 'lucide-react'; 
import { useState } from 'react';
import type { FinancialGoal, NewFinancialGoalData, UpdateFinancialGoalData, FinancialGoalStatus } from '@/types';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext'; 
// CurrencyInput is no longer used

const goalFormSchema = z.object({
  name: z.string().min(1, 'O nome da meta é obrigatório.').max(100, 'Máximo de 100 caracteres.'),
  targetAmount: z.coerce
    .number({ invalid_type_error: 'Valor alvo deve ser um número.' })
    .positive('O valor alvo deve ser positivo.'),
  currentAmount: z.coerce
    .number({ invalid_type_error: 'Valor atual deve ser um número.' })
    .min(0, 'O valor atual não pode ser negativo.')
    .optional(),
  targetDate: z.date().optional().nullable(),
  description: z.string().max(250, 'Máximo de 250 caracteres.').optional().nullable(),
  icon: z.string().optional().nullable(),
  status: z.enum(['active', 'achieved', 'abandoned']).optional(),
});

type GoalFormValues = z.infer<typeof goalFormSchema>;

interface FinancialGoalFormProps {
  userId: string;
  existingGoal?: FinancialGoal | null;
  onSuccess: (goal: FinancialGoal) => void;
  setOpen: (open: boolean) => void;
}

const iconOptions = [
  { value: 'PiggyBank', label: 'Cofrinho', icon: PiggyBank },
  { value: 'Target', label: 'Alvo', icon: Target },
  { value: 'TrendingUp', label: 'Progresso', icon: TrendingUp },
  { value: 'Flag', label: 'Bandeira', icon: Flag },
  { value: 'Award', label: 'Prêmio', icon: Flag }, 
  { value: 'Briefcase', label: 'Maleta', icon: Flag }, 
  { value: 'Car', label: 'Carro', icon: Flag }, 
  { value: 'Home', label: 'Casa', icon: Flag }, 
  { value: 'Gift', label: 'Presente', icon: Flag }, 
  { value: 'GraduationCap', label: 'Formatura', icon: Flag }, 
];


export function FinancialGoalForm({ userId, existingGoal, onSuccess, setOpen }: FinancialGoalFormProps) {
  const { toast } = useToast();
  const { getToken } = useAuth(); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultValues: Partial<GoalFormValues> = existingGoal
    ? {
        ...existingGoal,
        targetDate: existingGoal.targetDate ? parseISO(existingGoal.targetDate) : null,
        currentAmount: existingGoal.currentAmount || 0,
      }
    : {
        name: '',
        targetAmount: undefined,
        currentAmount: 0,
        targetDate: null,
        description: '',
        icon: 'PiggyBank', 
        status: 'active',
      };

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues,
  });

  const onSubmit = async (values: GoalFormValues) => {
    setIsSubmitting(true);
    const token = getToken();
    if (!token) {
      toast({ variant: 'destructive', title: 'Erro de Autenticação', description: 'Sessão inválida.' });
      setIsSubmitting(false);
      return;
    }

    const goalData: NewFinancialGoalData | UpdateFinancialGoalData = {
      ...values,
      targetDate: values.targetDate ? format(values.targetDate, 'yyyy-MM-dd') : null,
      currentAmount: values.currentAmount || 0,
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    try {
      let response;
      if (existingGoal) {
        response = await fetch(`/api/goals/${existingGoal.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(goalData),
        });
      } else {
        response = await fetch('/api/goals', {
          method: 'POST',
          headers,
          body: JSON.stringify(goalData),
        });
      }

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: 'Sucesso!',
          description: `Meta ${existingGoal ? 'atualizada' : 'criada'} com sucesso.`,
        });
        
        const mockId = existingGoal ? existingGoal.id : result.goalId || 'temp-id';
        const now = Date.now();
        onSuccess({
          id: mockId,
          userId,
          ...values,
          targetAmount: values.targetAmount!, 
          currentAmount: values.currentAmount || 0,
          targetDate: values.targetDate ? format(values.targetDate, 'yyyy-MM-dd') : null,
          status: values.status || 'active',
          createdAt: existingGoal ? existingGoal.createdAt : now,
          updatedAt: now,
        } as FinancialGoal);
        setOpen(false);
      } else {
        toast({
          variant: 'destructive',
          title: `Erro ao ${existingGoal ? 'atualizar' : 'criar'} meta`,
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
              <FormLabel>Nome da Meta</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Viagem para a Disney" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="targetAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Alvo (R$)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    lang="pt-BR"
                    placeholder="R$ 10.000,00"
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
          <FormField
            control={form.control}
            name="currentAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Atual (R$)</FormLabel>
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
        </div>

        <FormField
          control={form.control}
          name="targetDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Data Alvo (Opcional)</FormLabel>
              <DatePicker value={field.value || undefined} onChange={field.onChange} />
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
                <Textarea placeholder="Detalhes sobre sua meta..." {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="icon"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ícone (Opcional)</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value || 'PiggyBank'}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um ícone" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {iconOptions.map(opt => {
                    const IconComponent = opt.icon;
                    return (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center">
                          <IconComponent className="mr-2 h-4 w-4" />
                          {opt.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {existingGoal && (
           <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="achieved">Alcançada</SelectItem>
                    <SelectItem value="abandoned">Abandonada</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

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
              existingGoal ? 'Salvar Alterações' : 'Criar Meta'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
