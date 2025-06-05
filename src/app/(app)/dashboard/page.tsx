
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, CreditCardIcon, TrendingUp, TrendingDown, Loader2, AlertTriangleIcon, SearchX } from "lucide-react";
import { getTransactionsForUser, getCreditCardsForUser, getCreditCardPurchasesForUser } from '@/lib/databaseService';
import type { Transaction, CreditCard, CreditCardPurchase } from '@/types';
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
} from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";


interface DashboardSummary {
  balance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  currentMonthCardSpending: number;
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
      const [transactions, creditCards, creditCardPurchases] = await Promise.all([
        getTransactionsForUser(),
        getCreditCardsForUser(),
        getCreditCardPurchasesForUser(),
      ]);

      const currentDate = new Date();
      const currentMonthStart = startOfMonth(currentDate);
      const currentMonthEnd = endOfMonth(currentDate);

      let lifetimeBalance = 0;
      transactions.forEach(tx => {
        if (tx.type === 'income') lifetimeBalance += tx.amount;
        else lifetimeBalance -= tx.amount;
      });

      let monthlyIncome = 0;
      transactions.forEach(tx => {
        if (tx.type === 'income' && isWithinInterval(parseISO(tx.date), { start: currentMonthStart, end: currentMonthEnd })) {
          monthlyIncome += tx.amount;
        }
      });

      let monthlyExpenses = 0;
      const currentMonthExpensesByCategory: { [key: string]: number } = {};
      transactions.forEach(tx => {
        if (tx.type === 'expense' && isWithinInterval(parseISO(tx.date), { start: currentMonthStart, end: currentMonthEnd })) {
          monthlyExpenses += tx.amount;
          currentMonthExpensesByCategory[tx.category] = (currentMonthExpensesByCategory[tx.category] || 0) + tx.amount;
        }
      });
      
      const formattedExpensesByCategory: CategoryExpense[] = Object.entries(currentMonthExpensesByCategory)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);
      setExpensesByCategory(formattedExpensesByCategory);
      
      const prevMonthDate = subMonths(currentDate, 1);
      const targetPrevMonthClosingMonth = getMonth(prevMonthDate);
      const targetPrevMonthClosingYear = getYear(prevMonthDate);
      let ccBillsClosedLastMonth = 0;
      creditCards.forEach(card => {
        ccBillsClosedLastMonth += calculateInvoiceTotalForCardAndMonth(
          card,
          creditCardPurchases,
          targetPrevMonthClosingMonth,
          targetPrevMonthClosingYear
        );
      });
      monthlyExpenses += ccBillsClosedLastMonth;

      let currentMonthCardSpending = 0;
      const targetCurrentMonthClosingMonth = getMonth(currentDate);
      const targetCurrentMonthClosingYear = getYear(currentDate);
      creditCards.forEach(card => {
        currentMonthCardSpending += calculateInvoiceTotalForCardAndMonth(
          card,
          creditCardPurchases,
          targetCurrentMonthClosingMonth,
          targetCurrentMonthClosingYear
        );
      });
      
      setSummary({
        balance: lifetimeBalance,
        monthlyIncome,
        monthlyExpenses,
        currentMonthCardSpending,
      });

    } catch (e: any) {
      console.error("Failed to fetch dashboard data:", e);
      setError("Falha ao carregar dados do painel. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [calculateInvoiceTotalForCardAndMonth]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

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

  const summaryCardsData = [
    { title: "Saldo Atual", value: summary.balance, icon: DollarSign, currency: true, color: "text-primary" },
    { title: "Receitas do Mês", value: summary.monthlyIncome, icon: TrendingUp, currency: true, color: "text-positive" },
    { title: "Despesas do Mês", value: summary.monthlyExpenses, icon: TrendingDown, currency: true, color: "text-negative" },
    { title: "Gastos nos Cartões (Mês Atual)", value: summary.currentMonthCardSpending, icon: CreditCardIcon, currency: true, color: "text-blue-500", link: "/credit-cards" },
  ];


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Painel Financeiro</h1>
        <p className="text-muted-foreground">
          Resumo da sua saúde financeira.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryCardsData.map((cardItem) => { // Renamed card to cardItem to avoid conflict with Card component
          const cardComponentContent = ( // Renamed cardContent to avoid conflict
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
            <CardTitle className="font-headline">Despesas por Categoria (Mês Atual)</CardTitle>
            <CardDescription>Distribuição dos seus gastos mensais diretos.</CardDescription>
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
                        tickFormatter={(value) => formatCurrency(value).replace(/\s?R\$\s?/,'')} // Compact currency
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
                  Nenhuma despesa (sem ser de cartão) registrada este mês para exibir no gráfico.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline">Próximas Contas</CardTitle>
            <CardDescription>Fique de olho nos seus próximos pagamentos.</CardDescription>
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

