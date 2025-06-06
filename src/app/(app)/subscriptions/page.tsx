
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Repeat, Sun, AlertTriangleIcon, SearchX, CalendarDays, Tag, DollarSign } from "lucide-react";
import type { Transaction, RecurrenceFrequency } from '@/types';
import { getTransactionsForUser } from '@/lib/databaseService';
import { formatCurrency, cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
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
      setRecurringExpenses(filteredExpenses.sort((a,b) => a.category.localeCompare(b.category) || a.description!.localeCompare(b.description!)));
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
        // Handle case where user is definitively not logged in after auth check
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
        {recurringExpenses.map((expense) => (
          <Card key={expense.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                 <CardTitle className="text-lg font-semibold flex items-center">
                    <Repeat className="mr-2 h-5 w-5 text-primary opacity-80" />
                    {expense.description || "Despesa Recorrente"}
                 </CardTitle>
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
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground pt-2 pb-3">
              Registrada em: {format(new Date(expense.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
            </CardFooter>
          </Card>
        ))}
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
        {/* Botão de Adicionar pode ser incluído no futuro se necessário, mas por ora é só visualização */}
      </div>
      {renderContent()}
    </div>
  );
}
