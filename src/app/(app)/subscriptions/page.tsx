
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Repeat, Sun, AlertTriangleIcon, SearchX, CalendarDays, Tag, DollarSign, CheckCircle2 } from "lucide-react"; // Added CheckCircle2
import type { Transaction, RecurrenceFrequency } from '@/types';
import { getTransactionsForUser } from '@/lib/databaseService';
import { formatCurrency, cn } from '@/lib/utils';
import { 
  format, 
  parseISO,
  startOfDay,
  getMonth,
  getYear,
  getDate,
  getDaysInMonth,
  getDay,
  startOfMonth,
  addDays,
  isSameMonth,
  addWeeks,
  isPast,
  isToday
} from 'date-fns'; // Added necessary date-fns functions
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

const recurrenceFrequencyMap: Record<RecurrenceFrequency, string> = {
  none: 'Não Recorrente',
  monthly: 'Mensal',
  weekly: 'Semanal',
  annually: 'Anual',
};

export default function SubscriptionsPage() {
  const { user, loading: authLoading } = useAuth();
  const [recurringExpenses, setRecurringExpenses] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchRecurringExpenses = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const allTransactions = await getTransactionsForUser(user.id);
      const filteredExpenses = allTransactions.filter(
        (tx) => tx.type === 'expense' && tx.recurrenceFrequency && tx.recurrenceFrequency !== 'none'
      );
      setRecurringExpenses(filteredExpenses.sort((a,b) => a.category.localeCompare(b.category) || (a.description || "").localeCompare(b.description || "")));
    } catch (e: any) {
      const errorMessage = (e && typeof e.message === 'string') ? e.message : 'Falha ao carregar despesas recorrentes.';
      console.error("Failed to fetch recurring expenses:", errorMessage);
      setError("Falha ao carregar dados. Tente novamente.");
      toast({
        variant: "destructive",
        title: "Erro ao Carregar Dados",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        fetchRecurringExpenses();
      } else {
        setIsLoading(false);
        setError("Você precisa estar logado para ver suas assinaturas.");
        setRecurringExpenses([]);
      }
    }
  }, [fetchRecurringExpenses, user, authLoading]);


  if (authLoading || (isLoading && !user)) {
    return (
      <div className="flex items-center justify-center h-64">
        <Sun className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Carregando...</p>
      </div>
    );
  }
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64 col-span-full">
          <Sun className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Carregando assinaturas...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-destructive col-span-full">
          <AlertTriangleIcon className="h-12 w-12 mb-3" />
          <p className="text-lg font-semibold">{error}</p>
        </div>
      );
    }

    if (recurringExpenses.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground col-span-full">
          <SearchX className="h-12 w-12 mb-3" />
          <p className="text-lg">Nenhuma despesa recorrente encontrada.</p>
          <p className="text-sm">Transações marcadas como mensais, semanais ou anuais aparecerão aqui.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recurringExpenses.map((expense) => {
          const today = startOfDay(new Date());
          const currentMonth = getMonth(today);
          const currentYear = getYear(today);
          let expectedPaymentDateThisMonth: Date | null = null;

          const lastRecordedDate = parseISO(expense.date);

          if (expense.recurrenceFrequency === 'monthly') {
            const paymentDayOfMonth = getDate(lastRecordedDate);
            const dayInCurrentMonth = Math.min(paymentDayOfMonth, getDaysInMonth(new Date(currentYear, currentMonth)));
            expectedPaymentDateThisMonth = startOfDay(new Date(currentYear, currentMonth, dayInCurrentMonth));
          } else if (expense.recurrenceFrequency === 'annually') {
            const paymentDayOfMonth = getDate(lastRecordedDate);
            const paymentMonth = getMonth(lastRecordedDate);
            if (paymentMonth === currentMonth) {
              const dayInCurrentMonth = Math.min(paymentDayOfMonth, getDaysInMonth(new Date(currentYear, currentMonth)));
              expectedPaymentDateThisMonth = startOfDay(new Date(currentYear, currentMonth, dayInCurrentMonth));
            }
          } else if (expense.recurrenceFrequency === 'weekly') {
            const originalDayOfWeek = getDay(lastRecordedDate);
            let firstDayOfCurrentMonth = startOfMonth(today);
            
            let firstOccurrenceThisMonth = new Date(firstDayOfCurrentMonth);
            let count = 0; // Safety break for loop
            while(getDay(firstOccurrenceThisMonth) !== originalDayOfWeek && count < 7) {
                firstOccurrenceThisMonth = addDays(firstOccurrenceThisMonth, 1);
                if (getMonth(firstOccurrenceThisMonth) !== currentMonth) {
                    firstOccurrenceThisMonth = null; 
                    break;
                }
                count++;
            }
            if(count >= 7) firstOccurrenceThisMonth = null; // Did not find the day in first week

            if (firstOccurrenceThisMonth && isSameMonth(firstOccurrenceThisMonth, today)) {
                let latestPastOrTodayOccurrenceInMonth: Date | null = null;
                let currentWeeklyDate = startOfDay(new Date(firstOccurrenceThisMonth));
                while(isSameMonth(currentWeeklyDate, today)) {
                    if (isPast(currentWeeklyDate) || isToday(currentWeeklyDate)) {
                        latestPastOrTodayOccurrenceInMonth = new Date(currentWeeklyDate);
                    } else {
                        break;
                    }
                    const nextWeeklyDate = addWeeks(currentWeeklyDate, 1);
                    if (getMonth(nextWeeklyDate) !== currentMonth && getMonth(currentWeeklyDate) === currentMonth) { // Check if adding a week crosses the month boundary
                        break; // stop if next iteration is in next month
                    }
                    currentWeeklyDate = nextWeeklyDate;
                }
                expectedPaymentDateThisMonth = latestPastOrTodayOccurrenceInMonth;
            }
          }

          const isPaidThisMonth = !!expectedPaymentDateThisMonth &&
                                  (isToday(expectedPaymentDateThisMonth) || isPast(expectedPaymentDateThisMonth)) &&
                                  isSameMonth(expectedPaymentDateThisMonth, today);
          
          return (
            <Card key={expense.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg font-semibold flex items-center">
                      <Repeat className="mr-2 h-5 w-5 text-primary opacity-80" />
                      {expense.description || "Despesa Recorrente"}
                  </CardTitle>
                  {isPaidThisMonth && (
                    <Badge variant="default" className="ml-auto text-xs bg-green-100 text-green-700 border-green-300 dark:bg-green-700/30 dark:text-green-300 dark:border-green-600">
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      Pago este Mês
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs pt-1">
                  <Badge variant="secondary">{expense.category}</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 flex-grow text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center"><DollarSign className="mr-1.5 h-4 w-4 opacity-70"/>Valor:</span>
                  <span className="font-semibold text-destructive">{formatCurrency(expense.amount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center"><Tag className="mr-1.5 h-4 w-4 opacity-70"/>Frequência:</span>
                  <span className="font-medium">{recurrenceFrequencyMap[expense.recurrenceFrequency || 'none']}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center"><CalendarDays className="mr-1.5 h-4 w-4 opacity-70"/>Último Registro:</span>
                  <span className="font-medium">{format(parseISO(expense.date), 'dd/MM/yyyy', { locale: ptBR })}</span>
                </div>
                 {expectedPaymentDateThisMonth && !isPaidThisMonth && isSameMonth(expectedPaymentDateThisMonth, today) && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 pt-1">
                        Próximo pagamento esperado em: {format(expectedPaymentDateThisMonth, 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                )}
              </CardContent>
              <CardFooter className="text-xs text-muted-foreground pt-2 pb-3">
                Registrada em: {format(new Date(expense.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    );
  };


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center">
            <Repeat className="mr-3 h-8 w-8 text-primary" />
            Minhas Assinaturas e Despesas Recorrentes
          </h1>
          <p className="text-muted-foreground">
            Revise seus gastos regulares para identificar oportunidades de economia.
          </p>
        </div>
      </div>
      {renderContent()}
    </div>
  );
}

