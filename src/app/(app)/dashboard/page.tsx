
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DollarSign, CreditCardIcon, TrendingUp, TrendingDown, Sun, AlertTriangleIcon, SearchX, ChevronLeft, ChevronRight, CalendarClock, PlusCircle, ShoppingBag, ListChecks, Clock, CheckCircle2 } from "lucide-react";
import { getTransactionsForUser, getCreditCardsForUser, getCreditCardPurchasesForUser, getLoansForUser } from '@/lib/databaseService';
import type { Transaction, CreditCard, CreditCardPurchase, Loan } from '@/types';
import { formatCurrency, cn } from "@/lib/utils";
import {
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  parseISO,
  getMonth,
  getYear,
  getDate,
  addMonths,
  subMonths,
  format as formatDateFns,
  isSameMonth,
  isSameYear,
  addWeeks,
  addYears,
  isBefore,
  isSameDay,
  startOfDay,
  lastDayOfMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DayProps } from "react-day-picker";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { CreditCardTransactionForm } from "@/components/credit-cards/CreditCardTransactionForm";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DashboardSummary {
  balance: number;
  selectedMonthIncome: number;
  selectedMonthExpenses: number;
  selectedMonthCardSpending: number;
}

interface CategoryExpense {
  category: string;
  total: number;
}

interface DailyTransactionSummary {
  income: number;
  expense: number;
  net: number;
}

interface ProjectedTransaction extends Transaction {
  projectedDate: Date;
  isPast: boolean;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProjections, setIsLoadingProjections] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expensesByCategory, setExpensesByCategory] = useState<CategoryExpense[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [allUserTransactions, setAllUserTransactions] = useState<Transaction[]>([]); // Raw transactions from DB
  const [projectedTransactionsForMonth, setProjectedTransactionsForMonth] = useState<ProjectedTransaction[]>([]);
  const [userCreditCards, setUserCreditCards] = useState<CreditCard[]>([]);

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isCreditCardPurchaseModalOpen, setIsCreditCardPurchaseModalOpen] = useState(false);


  const dailyTransactionSummaries = useMemo(() => {
    const summaries: Map<string, DailyTransactionSummary> = new Map();
    if (!allUserTransactions.length) return summaries;

    allUserTransactions.forEach(tx => {
      const dateKey = formatDateFns(parseISO(tx.date), 'yyyy-MM-dd');
      const daySummary = summaries.get(dateKey) || { income: 0, expense: 0, net: 0 };
      if (tx.type === 'income') {
        daySummary.income += tx.amount;
      } else {
        daySummary.expense += tx.amount;
      }
      daySummary.net = daySummary.income - daySummary.expense;
      summaries.set(dateKey, daySummary);
    });
    return summaries;
  }, [allUserTransactions]);

  const calendarModifiers = useMemo(() => {
    const daysWithNetIncome: Date[] = [];
    const daysWithNetExpense: Date[] = [];
    const daysWithNetZeroAndTransactions: Date[] = [];

    dailyTransactionSummaries.forEach((summary, dateKey) => {
      const date = parseISO(dateKey);
      if (summary.net > 0) {
        daysWithNetIncome.push(date);
      } else if (summary.net < 0) {
        daysWithNetExpense.push(date);
      } else if (summary.income > 0 || summary.expense > 0) {
        daysWithNetZeroAndTransactions.push(date);
      }
    });

    return {
      netIncome: daysWithNetIncome,
      netExpense: daysWithNetExpense,
      netZeroTransactions: daysWithNetZeroAndTransactions,
    };
  }, [dailyTransactionSummaries]);

  const calendarModifiersStyles = {
    netIncome: {
      backgroundColor: 'hsla(var(--positive)/ 0.2)',
      color: 'hsl(var(--positive-foreground))',
      fontWeight: 'bold',
    },
    netExpense: {
      backgroundColor: 'hsla(var(--negative)/ 0.2)',
      color: 'hsl(var(--negative-foreground))',
      fontWeight: 'bold',
     },
    netZeroTransactions: {
      backgroundColor: 'hsla(var(--muted)/ 0.5)',
      fontWeight: 'bold',
    },
  };

  function CustomDay(props: DayProps) {
    const dayNumberNode = <>{formatDateFns(props.date, "d")}</>;

    if (!isSameMonth(props.date, props.displayMonth) ) {
      return dayNumberNode;
    }

    const dayKey = formatDateFns(props.date, 'yyyy-MM-dd');
    const daySummary = dailyTransactionSummaries.get(dayKey);

    if (!daySummary) {
        return dayNumberNode;
    }

    let indicatorColorClass = "";
    if (daySummary.net > 0) indicatorColorClass = "bg-positive";
    else if (daySummary.net < 0) indicatorColorClass = "bg-negative";
    else if (daySummary.income > 0 || daySummary.expense > 0) indicatorColorClass = "bg-muted-foreground";

    return (
      <Popover>
        <PopoverTrigger asChild disabled={!daySummary}>
          <div className="relative h-full w-full flex items-center justify-center cursor-pointer">
            {dayNumberNode}
            {indicatorColorClass && (
              <span className={`absolute bottom-1 left-1/2 transform -translate-x-1/2 h-1.5 w-1.5 rounded-full ${indicatorColorClass}`}></span>
            )}
          </div>
        </PopoverTrigger>
        {daySummary && (
          <PopoverContent className="w-auto text-sm p-3 space-y-1 shadow-lg rounded-md border bg-popover text-popover-foreground">
            <p className="font-semibold text-center border-b pb-1 mb-1">{formatDateFns(props.date, 'PPP', { locale: ptBR })}</p>
            {daySummary.income > 0 && <p className="flex justify-between items-center"><TrendingUp className="h-4 w-4 mr-1 text-positive" /> Receitas: <span className="font-medium text-positive">{formatCurrency(daySummary.income)}</span></p>}
            {daySummary.expense > 0 && <p className="flex justify-between items-center"><TrendingDown className="h-4 w-4 mr-1 text-negative" /> Despesas: <span className="font-medium text-negative">{formatCurrency(daySummary.expense)}</span></p>}
            <p className="flex justify-between items-center pt-1 border-t mt-1"><DollarSign className="h-4 w-4 mr-1 text-primary"/> Saldo do Dia: <span className={`font-bold ${daySummary.net > 0 ? 'text-positive' : daySummary.net < 0 ? 'text-negative' : 'text-foreground'}`}>{formatCurrency(daySummary.net)}</span></p>
          </PopoverContent>
        )}
      </Popover>
    );
  }


  const calculateInvoiceTotalForCardAndMonth = useCallback(
    (
      card: CreditCard,
      allPurchases: CreditCardPurchase[],
      targetInvoiceClosingMonth: number,
      targetInvoiceClosingYear: number
    ): number => {
      let invoiceTotal = 0;
      const purchasesOnThisCard = allPurchases.filter(p => p.cardId === card.id);

      purchasesOnThisCard.forEach(purchase => {
        const purchaseDate = parseISO(purchase.date);
        const installmentAmount = purchase.totalAmount / purchase.installments;

        for (let i = 0; i < purchase.installments; i++) {
          let installmentPaymentDate = purchaseDate;

          if (getDate(purchaseDate) > card.closingDateDay) {
            installmentPaymentDate = addMonths(installmentPaymentDate, 1);
          }
          installmentPaymentDate = addMonths(installmentPaymentDate, i);

          const installmentInvoiceClosingMonth = getMonth(installmentPaymentDate);
          const installmentInvoiceClosingYear = getYear(installmentPaymentDate);

          if (
            installmentInvoiceClosingMonth === targetInvoiceClosingMonth &&
            installmentInvoiceClosingYear === targetInvoiceClosingYear
          ) {
            invoiceTotal += installmentAmount;
          }
        }
      });
      return invoiceTotal;
    },
    []
  );

  const getProjectedOccurrences = useCallback((transaction: Transaction, periodStart: Date, periodEnd: Date): Date[] => {
    const occurrences: Date[] = [];
    const originalDate = parseISO(transaction.date);

    if (!transaction.recurrenceFrequency || transaction.recurrenceFrequency === 'none') {
      // Non-recurring transactions only occur on their specified date
      if (isWithinInterval(originalDate, { start: periodStart, end: periodEnd })) {
        occurrences.push(originalDate);
      }
      return occurrences;
    }

    let currentDate = originalDate;

    // Advance to the first occurrence within or after the period start for weekly/monthly/annually
    if (transaction.recurrenceFrequency !== 'none') {
        while (isBefore(currentDate, periodStart)) {
            switch (transaction.recurrenceFrequency) {
                case 'monthly':
                    currentDate = addMonths(currentDate, 1);
                    // Adjust day if it exceeds the new month's length
                    const dayOfMonth = getDate(originalDate);
                    const lastDay = getDate(lastDayOfMonth(currentDate));
                    currentDate = new Date(getYear(currentDate), getMonth(currentDate), Math.min(dayOfMonth, lastDay));
                    break;
                case 'weekly':
                    currentDate = addWeeks(currentDate, 1);
                    break;
                case 'annually':
                    currentDate = addYears(currentDate, 1);
                    break;
            }
        }
    }


    while (isBefore(currentDate, periodEnd) || isSameDay(currentDate, periodEnd)) {
      if (isWithinInterval(currentDate, { start: periodStart, end: periodEnd })) {
        occurrences.push(currentDate);
      }

      switch (transaction.recurrenceFrequency) {
        case 'monthly':
          currentDate = addMonths(currentDate, 1);
          const dayOfMonth = getDate(originalDate);
          const lastDay = getDate(lastDayOfMonth(currentDate));
          currentDate = new Date(getYear(currentDate), getMonth(currentDate), Math.min(dayOfMonth, lastDay));
          break;
        case 'weekly':
          currentDate = addWeeks(currentDate, 1);
          break;
        case 'annually':
          currentDate = addYears(currentDate, 1);
          break;
        default: // 'none' or unrecognized
          return occurrences; // Should not happen if first check is done
      }
       // Safety break for infinite loops, though logic should prevent this
       if (occurrences.length > 200) break;
    }
    return occurrences;
  }, []);


  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setIsLoadingProjections(false);
      return;
    }
    setIsLoading(true);
    setIsLoadingProjections(true);
    setError(null);
    try {
      const [fetchedTransactions, fetchedCreditCards, creditCardPurchases, loans] = await Promise.all([
        getTransactionsForUser(user.id),
        getCreditCardsForUser(user.id),
        getCreditCardPurchasesForUser(user.id),
        getLoansForUser(user.id),
      ]);
      setAllUserTransactions(fetchedTransactions);
      setUserCreditCards(fetchedCreditCards);

      let lifetimeBalance = 0;
      fetchedTransactions.forEach(tx => {
        if (tx.type === 'income') lifetimeBalance += tx.amount;
        else lifetimeBalance -= tx.amount;
      });

      const selectedMonthStart = startOfMonth(selectedDate);
      const selectedMonthEnd = endOfMonth(selectedDate);
      const today = startOfDay(new Date());

      let projectedMonthIncome = 0;
      let projectedMonthExpenses = 0;
      const currentProjectedTransactions: ProjectedTransaction[] = [];
      const selectedMonthExpensesByCategory: { [key: string]: number } = {};

      fetchedTransactions.forEach(tx => {
        const occurrences = getProjectedOccurrences(tx, selectedMonthStart, selectedMonthEnd);
        occurrences.forEach(occDate => {
          if (tx.type === 'income') {
            projectedMonthIncome += tx.amount;
          } else {
            projectedMonthExpenses += tx.amount;
            selectedMonthExpensesByCategory[tx.category] = (selectedMonthExpensesByCategory[tx.category] || 0) + tx.amount;
          }
          if (tx.recurrenceFrequency && tx.recurrenceFrequency !== 'none') {
             currentProjectedTransactions.push({
                ...tx,
                projectedDate: occDate,
                isPast: isBefore(occDate, today) && !isSameDay(occDate, today),
            });
          }
        });
      });
      
      currentProjectedTransactions.sort((a, b) => a.projectedDate.getTime() - b.projectedDate.getTime());
      setProjectedTransactionsForMonth(currentProjectedTransactions);
      setIsLoadingProjections(false);

      const formattedExpensesByCategory: CategoryExpense[] = Object.entries(selectedMonthExpensesByCategory)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);
      setExpensesByCategory(formattedExpensesByCategory);

      const monthBeforeSelected = subMonths(selectedDate, 1);
      const targetPrevMonthClosingMonth = getMonth(monthBeforeSelected);
      const targetPrevMonthClosingYear = getYear(monthBeforeSelected);
      let ccBillsClosedLastMonth = 0;
      fetchedCreditCards.forEach(card => {
        ccBillsClosedLastMonth += calculateInvoiceTotalForCardAndMonth(
          card,
          creditCardPurchases,
          targetPrevMonthClosingMonth,
          targetPrevMonthClosingYear
        );
      });

      let loanPaymentsThisMonth = 0;
      loans.forEach(loan => {
        const loanStartDate = parseISO(loan.startDate);
        const loanEndDate = parseISO(loan.endDate);
        // Check if the selected month falls within the loan payment period.
        // For simplicity, consider it a payment if the selected month's start is not after loan end
        // AND selected month's end is not before loan start.
        if (!isBefore(selectedMonthStart, loanStartDate) && !isBefore(loanEndDate,selectedMonthEnd)) {
            // More precise: check if a payment day for the loan falls in this month
            let paymentDate = loanStartDate;
            while(isBefore(paymentDate, loanEndDate) || isSameDay(paymentDate, loanEndDate)){
                if(isWithinInterval(paymentDate, {start: selectedMonthStart, end: selectedMonthEnd})){
                    loanPaymentsThisMonth += loan.installmentAmount;
                    break; // Count one payment per loan per month
                }
                paymentDate = addMonths(paymentDate, 1);
                 // Adjust day if it exceeds the new month's length
                const dayOfMonth = getDate(loanStartDate);
                const lastDay = getDate(lastDayOfMonth(paymentDate));
                paymentDate = new Date(getYear(paymentDate), getMonth(paymentDate), Math.min(dayOfMonth, lastDay));
            }
        }
      });

      const totalSelectedMonthExpensesWithLoansAndOldCC = projectedMonthExpenses + ccBillsClosedLastMonth + loanPaymentsThisMonth;


      let cardSpendingForSelectedMonthBills = 0;
      const targetSelectedMonthClosingMonth = getMonth(selectedDate);
      const targetSelectedMonthClosingYear = getYear(selectedDate);
      fetchedCreditCards.forEach(card => {
        cardSpendingForSelectedMonthBills += calculateInvoiceTotalForCardAndMonth(
          card,
          creditCardPurchases,
          targetSelectedMonthClosingMonth,
          targetSelectedMonthClosingYear
        );
      });

      setSummary({
        balance: lifetimeBalance,
        selectedMonthIncome: projectedMonthIncome,
        selectedMonthExpenses: totalSelectedMonthExpensesWithLoansAndOldCC,
        selectedMonthCardSpending: cardSpendingForSelectedMonthBills,
      });

    } catch (e: any) {
      console.error("Failed to fetch dashboard data:", e);
      setError("Falha ao carregar dados do painel. Tente novamente.");
      setIsLoadingProjections(false);
    } finally {
      setIsLoading(false);
    }
  }, [calculateInvoiceTotalForCardAndMonth, selectedDate, user, getProjectedOccurrences]);

  useEffect(() => {
    if (user && !authLoading) {
      fetchDashboardData();
    } else if (!authLoading && !user) {
      setIsLoading(false);
      setIsLoadingProjections(false);
      setError("Usuário não autenticado.");
    }
  }, [fetchDashboardData, user, authLoading]);

  const handlePreviousMonth = () => {
    setSelectedDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setSelectedDate(prev => addMonths(prev, 1));
  };

  const handleCurrentMonth = () => {
    setSelectedDate(new Date());
  };

  const isCurrentMonthSelected = () => {
    const today = new Date();
    return isSameMonth(selectedDate, today) && isSameYear(selectedDate, today);
  };

  const handleTransactionAdded = () => {
    setIsTransactionModalOpen(false);
    fetchDashboardData();
  };

  const handleCreditCardPurchaseAdded = () => {
    setIsCreditCardPurchaseModalOpen(false);
    fetchDashboardData();
  };


  if (isLoading || authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Sun className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Carregando painel...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive">
        <AlertTriangleIcon className="h-12 w-12 mb-3" />
        <p className="text-lg font-semibold">{error}</p>
      </div>
    );
  }

  if (!summary) {
     return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <SearchX className="h-12 w-12 mb-3" />
        <p className="text-lg">Nenhum dado disponível para exibir no painel.</p>
         {!user && <p className="text-sm">Por favor, faça login para ver seus dados.</p>}
      </div>
    );
  }

  const selectedMonthName = formatDateFns(selectedDate, 'MMMM', { locale: ptBR });


  const summaryCardsData = [
    { title: "Saldo Atual (Real)", value: summary.balance, icon: DollarSign, currency: true, color: "text-primary" },
    { title: `Receitas (${selectedMonthName})`, value: summary.selectedMonthIncome, icon: TrendingUp, currency: true, color: "text-positive" },
    { title: `Despesas (${selectedMonthName})`, value: summary.selectedMonthExpenses, icon: TrendingDown, currency: true, color: "text-negative" },
    { title: `Fatura Cartões (${selectedMonthName})`, value: summary.selectedMonthCardSpending, icon: CreditCardIcon, currency: true, color: "text-blue-500", link: "/credit-cards" },
  ];


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-1">
          <Button onClick={handlePreviousMonth} variant="outline" size="icon" aria-label="Mês anterior">
              <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-semibold text-center whitespace-nowrap tabular-nums mx-2">
              {formatDateFns(selectedDate, 'MMMM/yyyy', { locale: ptBR })}
          </h2>
          <Button onClick={handleNextMonth} variant="outline" size="icon" aria-label="Próximo mês">
              <ChevronRight className="h-5 w-5" />
          </Button>
      </div>

       <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center sm:justify-end gap-2">
         <Button onClick={handleCurrentMonth} variant="secondary" size="sm" aria-label="Mês Atual" disabled={isCurrentMonthSelected()} className="h-9">
            <CalendarClock className="mr-1.5 h-4 w-4"/> Mês Atual
          </Button>
          <Dialog open={isTransactionModalOpen} onOpenChange={setIsTransactionModalOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto" disabled={!user}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Nova Transação
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Adicionar Nova Transação</DialogTitle>
                <DialogDescription>Preencha os detalhes da sua transação.</DialogDescription>
              </DialogHeader>
              {user && <TransactionForm onSuccess={handleTransactionAdded} setOpen={setIsTransactionModalOpen} userId={user.id} />}
            </DialogContent>
          </Dialog>
          <Dialog open={isCreditCardPurchaseModalOpen} onOpenChange={setIsCreditCardPurchaseModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto" disabled={!user || userCreditCards.length === 0}>
                <ShoppingBag className="mr-2 h-4 w-4"/>
                Nova Compra
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Adicionar Compra Parcelada</DialogTitle>
                <DialogDescription>Registre uma nova compra no cartão de crédito.</DialogDescription>
              </DialogHeader>
              {user && <CreditCardTransactionForm userCreditCards={userCreditCards} onSuccess={handleCreditCardPurchaseAdded} setOpen={setIsCreditCardPurchaseModalOpen} userId={user.id} />}
            </DialogContent>
          </Dialog>
       </div>


      <div className="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryCardsData.map((cardItem) => {
          const cardComponentContent = (
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{cardItem.title}</CardTitle>
                <cardItem.icon className={`h-5 w-5 ${cardItem.color || 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${cardItem.color || ''}`}>
                  {cardItem.currency ? formatCurrency(cardItem.value) : `${cardItem.value.toFixed(2)}${cardItem.unit || ''}`}
                </div>
              </CardContent>
            </Card>
          );
          return cardItem.link ? (
            <Link href={cardItem.link} key={cardItem.title} className="flex">
              {cardComponentContent}
            </Link>
          ) : (
            <div key={cardItem.title} className="flex">
             {cardComponentContent}
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-lg md:col-span-1">
          <CardHeader>
            <CardTitle className="font-headline">Despesas Projetadas ({selectedMonthName})</CardTitle>
            <CardDescription>Distribuição dos gastos diretos e recorrentes previstos para o mês.</CardDescription>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length > 0 ? (
              <ScrollArea className="h-[300px] pr-3">
                <ul className="space-y-2">
                  {expensesByCategory.map((expense) => (
                    <li key={expense.category} className="flex justify-between items-center py-2 border-b last:border-b-0">
                      <span className="text-sm text-foreground truncate pr-2" title={expense.category}>{expense.category}</span>
                      <span className="text-sm font-semibold text-negative whitespace-nowrap">{formatCurrency(expense.total)}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            ) : (
              <div className="h-[150px] flex items-center justify-center bg-muted/50 rounded-md p-4">
                <p className="text-muted-foreground text-center">
                  Nenhuma despesa projetada para {selectedMonthName.toLowerCase()}.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg md:col-span-2">
           <CardHeader>
            <CardTitle className="font-headline flex items-center"><ListChecks className="mr-2 h-6 w-6 text-primary"/>Agendamentos para {selectedMonthName}</CardTitle>
            <CardDescription>Transações recorrentes previstas para este mês.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingProjections ? (
                <div className="h-[300px] flex items-center justify-center">
                    <Sun className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Carregando agendamentos...</p>
                </div>
            ) : projectedTransactionsForMonth.length > 0 ? (
                <ScrollArea className="h-[300px] pr-3">
                    <ul className="space-y-3">
                    {projectedTransactionsForMonth.map((tx) => (
                        <li key={`${tx.id}-${tx.projectedDate.toISOString()}`} className="flex items-center justify-between p-2.5 border rounded-md bg-card hover:bg-muted/50 transition-colors">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" title={tx.description || tx.category}>{tx.description || tx.category}</p>
                            <p className={cn("text-xs", tx.isPast ? "text-muted-foreground" : "text-blue-600 dark:text-blue-400")}>
                            {formatDateFns(tx.projectedDate, 'dd/MM/yyyy', { locale: ptBR })}
                            </p>
                        </div>
                        <div className="flex items-center ml-2">
                            <span className={cn(
                                "text-sm font-semibold mr-2 whitespace-nowrap",
                                tx.type === 'income' ? 'text-positive' : 'text-negative'
                            )}>
                            {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                            </span>
                            <Badge variant={tx.isPast ? "outline" : "default"} className={cn("text-xs h-6 px-2 py-0.5", tx.isPast ? "border-yellow-500 text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/30" : "bg-blue-500 text-white")}>
                                {tx.isPast ? <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> : <Clock className="h-3.5 w-3.5 mr-1" />}
                                {tx.isPast ? 'Ocorrida' : 'Agendada'}
                            </Badge>
                        </div>
                        </li>
                    ))}
                    </ul>
                </ScrollArea>
            ) : (
                <div className="h-[150px] flex flex-col items-center justify-center bg-muted/50 rounded-md p-4">
                    <SearchX className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground text-center">
                    Nenhuma transação recorrente agendada para {selectedMonthName.toLowerCase()}.
                    </p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline">Calendário Financeiro (Transações Reais)</CardTitle>
            <CardDescription>Movimentações já registradas no sistema.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            {allUserTransactions ? (
               <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(day) => {
                  if (day) {
                    if (!isSameMonth(day, selectedDate)) {
                      setSelectedDate(day);
                    }
                  }
                }}
                month={selectedDate}
                onMonthChange={setSelectedDate}
                locale={ptBR}
                modifiers={calendarModifiers}
                modifiersStyles={calendarModifiersStyles}
                components={{ Day: CustomDay }}
                className="rounded-md border p-0 sm:p-2"
                classNames={{
                    caption_label: "text-lg font-medium",
                    head_cell: "w-10 sm:w-12",
                    day: "h-10 w-10 sm:h-12 sm:w-12",
                    day_selected: "bg-primary text-primary-foreground hover:bg-primary focus:bg-primary",
                }}
              />
            ) : (
               <div className="h-[300px] flex items-center justify-center bg-muted/50 rounded-md">
                 <p className="text-muted-foreground">Carregando transações para o calendário...</p>
               </div>
            )}
          </CardContent>
        </Card>

    </div>
  );
}
