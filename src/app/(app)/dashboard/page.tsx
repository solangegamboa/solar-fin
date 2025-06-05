
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Landmark, CreditCardIcon, TrendingUp, TrendingDown, Loader2, AlertTriangleIcon, SearchX } from "lucide-react";
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
  setDate,
  addMonths,
  subMonths,
  getDate,
} from 'date-fns';

interface DashboardSummary {
  balance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  currentMonthCardSpending: number;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateInvoiceTotalForCardAndMonth = useCallback(
    (
      card: CreditCard,
      allPurchases: CreditCardPurchase[],
      targetInvoiceClosingMonth: number, // 0-indexed month
      targetInvoiceClosingYear: number
    ): number => {
      let invoiceTotal = 0;
      const purchasesOnThisCard = allPurchases.filter(p => p.cardId === card.id);

      purchasesOnThisCard.forEach(purchase => {
        const purchaseDate = parseISO(purchase.date);
        const installmentAmount = purchase.totalAmount / purchase.installments;

        for (let i = 0; i < purchase.installments; i++) {
          // Determine the actual month/year this installment contributes to an invoice
          let installmentPaymentDate = purchaseDate;
          
          // If purchase is made after closing day of purchase month, first installment is on next month's bill
          if (getDate(purchaseDate) > card.closingDateDay) {
            installmentPaymentDate = addMonths(installmentPaymentDate, 1);
          }
          // Add subsequent installment months
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

      // 1. Saldo Atual (Lifetime)
      let lifetimeBalance = 0;
      transactions.forEach(tx => {
        if (tx.type === 'income') lifetimeBalance += tx.amount;
        else lifetimeBalance -= tx.amount;
      });

      // 2. Receitas do Mês
      let monthlyIncome = 0;
      transactions.forEach(tx => {
        if (tx.type === 'income' && isWithinInterval(parseISO(tx.date), { start: currentMonthStart, end: currentMonthEnd })) {
          monthlyIncome += tx.amount;
        }
      });

      // 3. Despesas do Mês (Direct Expenses + Credit Card Bills closed last month)
      let monthlyExpenses = 0;
      transactions.forEach(tx => {
        if (tx.type === 'expense' && isWithinInterval(parseISO(tx.date), { start: currentMonthStart, end: currentMonthEnd })) {
          monthlyExpenses += tx.amount;
        }
      });
      
      // Calculate CC bills closed last month
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

      // 4. Gastos nos Cartões (Mês Atual) - Bills closing this month
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
      
      // Savings Rate
      const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;

      setSummary({
        balance: lifetimeBalance,
        monthlyIncome,
        monthlyExpenses,
        savingsRate,
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
    // Taxa de poupança pode precisar ser ajustada para caber, ou movida. Para caber em 2x2, um card será maior ou teremos mais uma linha.
    // Por enquanto, vou deixar 4 cards para manter o layout 2x2.
    // { title: "Taxa de Poupança", value: summary.savingsRate, icon: Landmark, currency: false, unit: "%", color: "text-indigo-500" },
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
        {summaryCardsData.map((card) => {
          const cardContent = (
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className={`h-5 w-5 ${card.color || 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${card.color || ''}`}>
                  {card.currency ? formatCurrency(card.value) : `${card.value.toFixed(2)}${card.unit || ''}`}
                </div>
                {/* <p className="text-xs text-muted-foreground">+20.1% from last month</p> */}
              </CardContent>
            </Card>
          );
          return card.link ? (
            <Link href={card.link} key={card.title} className="flex">
              {cardContent}
            </Link>
          ) : (
            <div key={card.title} className="flex">
             {cardContent}
            </div>
          );
        })}
      </div>
      
       <Card className="shadow-lg lg:col-span-2"> {/* Taxa de poupança em um card separado abaixo */}
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Poupança</CardTitle>
            <Landmark className="h-5 w-5 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-500">
              {summary.savingsRate.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Baseado nas receitas e despesas do mês atual.
            </p>
          </CardContent>
        </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline">Despesas por Categoria</CardTitle>
            <CardDescription>Distribuição dos seus gastos mensais diretos.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center bg-muted/50 rounded-md">
              <p className="text-muted-foreground">Gráfico de Despesas em breve</p>
            </div>
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
