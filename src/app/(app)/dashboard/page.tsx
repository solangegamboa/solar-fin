
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { DollarSign, CreditCardIcon, TrendingUp, TrendingDown, Loader2, AlertTriangleIcon, SearchX, ChevronLeft, ChevronRight, CalendarClock, Landmark } from "lucide-react";
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
  format,
  isSameMonth,
  isSameYear,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";


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

const chartConfig = {
  total: {
    label: "Total Gasto (R$)",
    color: "hsl(var(--chart-1))", 
  },
} satisfies ChartConfig;

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expensesByCategory, setExpensesByCategory] = useState<CategoryExpense[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

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
    setIsLoading(true);
    setError(null);
    try {
      const [transactions, creditCards, creditCardPurchases, loans] = await Promise.all([
        getTransactionsForUser(),
        getCreditCardsForUser(),
        getCreditCardPurchasesForUser(),
        getLoansForUser(),
      ]);

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
  }, [calculateInvoiceTotalForCardAndMonth, selectedDate]); 

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]); 

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


  if (isLoading) {
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
      </div>
    );
  }

  const selectedMonthName = format(selectedDate, 'MMMM', { locale: ptBR });
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
                {format(selectedDate, 'MMMM/yyyy', { locale: ptBR })}
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
            <CardTitle className="font-headline">Próximas Contas (Mês Selecionado)</CardTitle>
            <CardDescription>Fique de olho nos seus próximos pagamentos para {selectedMonthName.toLowerCase()}.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center bg-muted/50 rounded-md">
              <p className="text-muted-foreground">Lista de Próximas Contas em breve</p>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
