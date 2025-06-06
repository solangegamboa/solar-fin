
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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, Percent, CalendarClock, RefreshCw, Equal } from 'lucide-react';
import { CurrencyInput } from '@/components/ui/currency-input';

const simpleInterestSchema = z.object({
  principal: z.coerce
    .number({ invalid_type_error: 'Valor principal deve ser um número.' })
    .positive({ message: 'O valor principal deve ser positivo.' }),
  annualRate: z.coerce
    .number({ invalid_type_error: 'Taxa anual deve ser um número.' })
    .min(0, { message: 'A taxa anual não pode ser negativa.' }),
  timeInYears: z.coerce
    .number({ invalid_type_error: 'Tempo deve ser um número.' })
    .positive({ message: 'O tempo deve ser positivo.' }),
});

type SimpleInterestFormValues = z.infer<typeof simpleInterestSchema>;

export function SimpleInterestCalculator() {
  const [calculatedInterest, setCalculatedInterest] = useState<number | null>(null);
  const [totalAmount, setTotalAmount] = useState<number | null>(null);

  const form = useForm<SimpleInterestFormValues>({
    resolver: zodResolver(simpleInterestSchema),
    defaultValues: {
      principal: undefined,
      annualRate: undefined,
      timeInYears: undefined,
    },
  });

  const onSubmit = (values: SimpleInterestFormValues) => {
    const principal = values.principal;
    const rate = values.annualRate / 100; // Convert percentage to decimal
    const time = values.timeInYears;

    const interest = principal * rate * time;
    const finalAmount = principal + interest;

    setCalculatedInterest(interest);
    setTotalAmount(finalAmount);
  };

  const handleClear = () => {
    form.reset({
        principal: undefined,
        annualRate: undefined,
        timeInYears: undefined,
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
            render={({ field: { onChange, onBlur, value, name, ref } }) => (
              <FormItem>
                <FormLabel className="flex items-center"><TrendingUp className="mr-2 h-4 w-4 text-muted-foreground" />Valor Principal (R$)</FormLabel>
                <FormControl>
                  <CurrencyInput
                    name={name}
                    value={value}
                    onValueChangeNumeric={(floatVal) => onChange(floatVal === undefined ? null : floatVal)}
                    onBlur={onBlur}
                    ref={ref}
                    placeholder="R$ 1.000,00"
                  />
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
                  <Input type="number" placeholder="Ex: 2.5 (para 2 anos e meio)" {...field} step="0.1" />
                </FormControl>
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
            {calculatedInterest !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Juros Simples Totais:</span>
                <span className="font-semibold text-primary">{formatCurrency(calculatedInterest)}</span>
              </div>
            )}
            {totalAmount !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Montante Final (Principal + Juros):</span>
                <span className="font-semibold text-primary">{formatCurrency(totalAmount)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
