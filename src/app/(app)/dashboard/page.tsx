
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { DollarSign, CreditCardIcon, TrendingUp, TrendingDown, Loader2, AlertTriangleIcon, SearchX, ChevronLeft, ChevronRight, CalendarClock, MoreHorizontal } from "lucide-react";
import { getTransactionsForUser, getCreditCardsForUser, getCreditCardPurchasesForUser, getLoansForUser } from '@/lib/databaseService';
import type { Transaction, CreditCard, CreditCardPurchase, Loan } from '@/types';
import { formatCurrency } from "@/lib/utils";
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
  format as formatDateFns, // Renamed to avoid conflict
  isSameMonth,
  isSameYear,
  isSameDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useAuth } from '@/contexts/AuthContext';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DayPicker, type DayProps } from "react-day-picker"; // Import DayPicker and DayProps

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

const chartConfig = {
  total: {
    label: "Total Gasto (R$)",
    color: "hsl(var(--chart-1))", 
  },
} satisfies ChartConfig;

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expensesByCategory, setExpensesByCategory] = useState<CategoryExpense[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);


  const dailyTransactionSummaries = useMemo(() => {
    const summaries: Map<string, DailyTransactionSummary> = new Map();
    if (!allTransactions.length) return summaries;

    allTransactions.forEach(tx => {
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
  }, [allTransactions]);

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
      } else if (summary.income > 0 || summary.expense > 0) { // Net zero but had transactions
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
    const dayKey = formatDateFns(props.date, 'yyyy-MM-dd');
    const daySummary = dailyTransactionSummaries.get(dayKey);

    if (!daySummary || !isSameMonth(props.date, props.displayMonth) ) {
      return <DayPicker.Day {...props} />;
    }
    
    let indicatorColorClass = "";
    if (daySummary.net > 0) indicatorColorClass = "bg-positive";
    else if (daySummary.net < 0) indicatorColorClass = "bg-negative";
    else if (daySummary.income > 0 || daySummary.expense > 0) indicatorColorClass = "bg-muted-foreground";


    return (
      <Popover>
        <PopoverTrigger asChild disabled={!daySummary}>
          <div className="relative">
            <DayPicker.Day {...props} className="cursor-pointer" />
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

  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setIsLoading(false); 
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [transactions, creditCards, creditCardPurchases, loans] = await Promise.all([
        getTransactionsForUser(user.id),
        getCreditCardsForUser(user.id),
        getCreditCardPurchasesForUser(user.id),
        getLoansForUser(user.id),
      ]);
      setAllTransactions(transactions); // Store all transactions for calendar

      let lifetimeBalance = 0;
      transactions.forEach(tx => {
        if (tx.type === 'income') lifetimeBalance += tx.amount;
        else lifetimeBalance -= tx.amount;
      });

      const selectedMonthStart = startOfMonth(selectedDate);
      const selectedMonthEnd = endOfMonth(selectedDate);

      let selectedMonthIncome = 0;
      transactions.forEach(tx => {
        if (tx.type === 'income' && isWithinInterval(parseISO(tx.date), { start: selectedMonthStart, end: selectedMonthEnd })) {
          selectedMonthIncome += tx.amount;
        }
      });

      let directMonthlyExpenses = 0;
      const selectedMonthExpensesByCategory: { [key: string]: number } = {};
      transactions.forEach(tx => {
        if (tx.type === 'expense' && isWithinInterval(parseISO(tx.date), { start: selectedMonthStart, end: selectedMonthEnd })) {
          directMonthlyExpenses += tx.amount;
          selectedMonthExpensesByCategory[tx.category] = (selectedMonthExpensesByCategory[tx.category] || 0) + tx.amount;
        }
      });
      
      const formattedExpensesByCategory: CategoryExpense[] = Object.entries(selectedMonthExpensesByCategory)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);
      setExpensesByCategory(formattedExpensesByCategory);
      
      const monthBeforeSelected = subMonths(selectedDate, 1);
      const targetPrevMonthClosingMonth = getMonth(monthBeforeSelected);
      const targetPrevMonthClosingYear = getYear(monthBeforeSelected);
      let ccBillsClosedLastMonth = 0;
      creditCards.forEach(card => {
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
        if (isWithinInterval(selectedDate, { start: loanStartDate, end: loanEndDate })) {
          loanPaymentsThisMonth += loan.installmentAmount;
        }
      });
      
      const totalSelectedMonthExpenses = directMonthlyExpenses + ccBillsClosedLastMonth + loanPaymentsThisMonth;

      let cardSpendingForSelectedMonthBills = 0;
      const targetSelectedMonthClosingMonth = getMonth(selectedDate);
      const targetSelectedMonthClosingYear = getYear(selectedDate);
      creditCards.forEach(card => {
        cardSpendingForSelectedMonthBills += calculateInvoiceTotalForCardAndMonth(
          card,
          creditCardPurchases,
          targetSelectedMonthClosingMonth,
          targetSelectedMonthClosingYear
        );
      });
      
      setSummary({
        balance: lifetimeBalance,
        selectedMonthIncome,
        selectedMonthExpenses: totalSelectedMonthExpenses,
        selectedMonthCardSpending: cardSpendingForSelectedMonthBills,
      });

    } catch (e: any) {
      console.error("Failed to fetch dashboard data:", e);
      setError("Falha ao carregar dados do painel. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [calculateInvoiceTotalForCardAndMonth, selectedDate, user]); 

  useEffect(() => {
    if (user && !authLoading) {
      fetchDashboardData();
    } else if (!authLoading && !user) {
      setIsLoading(false);
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


  if (isLoading || authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
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
  const selectedMonthNameCapitalized = selectedMonthName.charAt(0).toUpperCase() + selectedMonthName.slice(1);


  const summaryCardsData = [
    { title: "Saldo Atual (Total)", value: summary.balance, icon: DollarSign, currency: true, color: "text-primary" },
    { title: `Receitas de ${selectedMonthNameCapitalized}`, value: summary.selectedMonthIncome, icon: TrendingUp, currency: true, color: "text-positive" },
    { title: `Despesas de ${selectedMonthNameCapitalized}`, value: summary.selectedMonthExpenses, icon: TrendingDown, currency: true, color: "text-negative" },
    { title: `Cartões (Fatura ${selectedMonthNameCapitalized})`, value: summary.selectedMonthCardSpending, icon: CreditCardIcon, currency: true, color: "text-blue-500", link: "/credit-cards" },
  ];


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Painel Financeiro</h1>
          <p className="text-muted-foreground">
            Resumo da sua saúde financeira.
          </p>
        </div>
         <div className="flex items-center justify-center gap-2 sm:gap-4">
            <Button onClick={handlePreviousMonth} variant="outline" size="sm">
                <ChevronLeft className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Anterior</span>
            </Button>
            <h2 className="text-lg sm:text-xl font-semibold text-center whitespace-nowrap tabular-nums">
                {formatDateFns(selectedDate, 'MMMM/yyyy', { locale: ptBR })}
            </h2>
            <Button onClick={handleNextMonth} variant="outline" size="sm">
                <span className="hidden sm:inline">Próximo</span> <ChevronRight className="h-4 w-4 sm:ml-1" />
            </Button>
         </div>
      </div>
       <div className="text-center sm:text-right">
         <Button onClick={handleCurrentMonth} variant="secondary" size="sm" disabled={isCurrentMonthSelected()}>
            <CalendarClock className="h-4 w-4 mr-2" /> Mês Atual
          </Button>
       </div>


      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline">Despesas por Categoria ({selectedMonthNameCapitalized})</CardTitle>
            <CardDescription>Distribuição dos seus gastos mensais diretos (sem cartão, sem empréstimos).</CardDescription>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length > 0 ? (
              <ChartContainer config={chartConfig} className="min-h-[200px] w-full aspect-video">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart 
                    data={expensesByCategory} 
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis 
                        type="number" 
                        axisLine={false} 
                        tickLine={false}
                        tickFormatter={(value) => formatCurrency(value).replace(/\s?R\$\s?/,'')}
                        />
                    <YAxis 
                        dataKey="category" 
                        type="category" 
                        tickLine={false} 
                        axisLine={false} 
                        tickMargin={5}
                        width={100}
                        />
                    <ChartTooltipContent
                      formatter={(value, name, props) => (
                        <div className='p-1'>
                          <p className="font-medium text-sm">{props.payload.category}</p>
                          <p className='text-xs text-foreground'>{formatCurrency(value as number)}</p>
                        </div>
                      )}
                      cursorClassName="fill-muted/50"
                    />
                    <Bar dataKey="total" fill="var(--color-total)" radius={4} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center bg-muted/50 rounded-md">
                <p className="text-muted-foreground text-center">
                  Nenhuma despesa direta registrada em {selectedMonthName.toLowerCase()} para exibir no gráfico.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline">Calendário Financeiro ({selectedMonthNameCapitalized})</CardTitle>
            <CardDescription>Visão geral das suas transações no mês. Clique em um dia para ver detalhes.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            {allTransactions ? (
               <Calendar
                mode="single"
                selected={selectedDate} // Can be used to highlight, but we use onDayClick for interaction
                onSelect={(day) => {
                  if (day) {
                    // Check if the clicked day is in a different month than current selectedDate
                    if (!isSameMonth(day, selectedDate)) {
                      setSelectedDate(day); // This will trigger re-fetch and re-render for new month
                    }
                    // Popover is handled by CustomDay component
                  }
                }}
                month={selectedDate}
                onMonthChange={setSelectedDate} // Sync calendar month with dashboard month
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

    </div>
  );
}

