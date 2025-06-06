
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, Percent, CalendarClock, Layers, RefreshCw, Equal } from 'lucide-react';

const compoundInterestSchema = z.object({
  principal: z.coerce
    .number({ invalid_type_error: 'Valor principal deve ser um número.' })
    .positive({ message: 'O valor principal deve ser positivo.' }),
  annualRate: z.coerce
    .number({ invalid_type_error: 'Taxa anual deve ser um número.' })
    .min(0, { message: 'A taxa anual não pode ser negativa.' }),
  timeInYears: z.coerce
    .number({ invalid_type_error: 'Tempo deve ser um número.' })
    .positive({ message: 'O tempo deve ser positivo.' }),
  compoundingFrequency: z.enum(['annually', 'monthly'], {
    required_error: 'Selecione a frequência de capitalização.',
  }),
});

type CompoundInterestFormValues = z.infer<typeof compoundInterestSchema>;

export function CompoundInterestCalculator() {
  const [calculatedInterest, setCalculatedInterest] = useState<number | null>(null);
  const [totalAmount, setTotalAmount] = useState<number | null>(null);

  const form = useForm<CompoundInterestFormValues>({
    resolver: zodResolver(compoundInterestSchema),
    defaultValues: {
      principal: undefined,
      annualRate: undefined,
      timeInYears: undefined,
      compoundingFrequency: 'annually',
    },
  });

  const onSubmit = (values: CompoundInterestFormValues) => {
    const principal = values.principal;
    const annualRateDecimal = values.annualRate / 100; // Convert annual rate to decimal
    const timeInYears = values.timeInYears;
    
    let n = 1; // Compounding periods per year
    let ratePerPeriod = annualRateDecimal;
    let numberOfPeriods = timeInYears;

    if (values.compoundingFrequency === 'monthly') {
      n = 12;
      ratePerPeriod = annualRateDecimal / n;
      numberOfPeriods = timeInYears * n;
    } else { // annually
      n = 1;
      ratePerPeriod = annualRateDecimal / n; // Effectively annualRateDecimal
      numberOfPeriods = timeInYears * n;   // Effectively timeInYears
    }
    
    // M = P * (1 + i/n)^(n*t)
    // Using ratePerPeriod and numberOfPeriods makes it: M = P * (1 + ratePerPeriod)^numberOfPeriods
    const finalAmount = principal * Math.pow((1 + ratePerPeriod), numberOfPeriods);
    const interest = finalAmount - principal;

    setCalculatedInterest(interest);
    setTotalAmount(finalAmount);
  };

  const handleClear = () => {
    form.reset({
        principal: undefined,
        annualRate: undefined,
        timeInYears: undefined,
        compoundingFrequency: 'annually',
    });
    setCalculatedInterest(null);
    setTotalAmount(null);
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="principal"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><TrendingUp className="mr-2 h-4 w-4 text-muted-foreground" />Valor Principal (R$)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Ex: 1000.00" {...field} step="0.01" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="annualRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Percent className="mr-2 h-4 w-4 text-muted-foreground" />Taxa de Juros Anual (%)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Ex: 5 (para 5%)" {...field} step="0.01" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="timeInYears"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><CalendarClock className="mr-2 h-4 w-4 text-muted-foreground" />Tempo (anos)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Ex: 3" {...field} step="0.1" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="compoundingFrequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Layers className="mr-2 h-4 w-4 text-muted-foreground" />Período de Capitalização</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a frequência" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="annually">Anual</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    {/* Could add: "semiannually", "quarterly" */}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button type="submit" className="w-full sm:w-auto">Calcular</Button>
            <Button type="button" variant="outline" onClick={handleClear} className="w-full sm:w-auto">
                 <RefreshCw className="mr-2 h-4 w-4"/> Limpar
            </Button>
          </div>
        </form>
      </Form>

      {(calculatedInterest !== null || totalAmount !== null) && (
        <Card className="mt-6 bg-muted/30 border-dashed">
          <CardHeader>
            <CardTitle className="text-lg flex items-center"><Equal className="mr-2 h-5 w-5 text-primary"/>Resultado do Cálculo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {totalAmount !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Montante Final (Principal + Juros):</span>
                <span className="font-semibold text-primary">{formatCurrency(totalAmount)}</span>
              </div>
            )}
            {calculatedInterest !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Juros Compostos Totais:</span>
                <span className="font-semibold text-primary">{formatCurrency(calculatedInterest)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
