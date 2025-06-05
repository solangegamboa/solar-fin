
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
import { DollarSign, CreditCardIcon, TrendingUp, TrendingDown, Sun, AlertTriangleIcon, SearchX, ChevronLeft, ChevronRight, CalendarClock, PlusCircle, ShoppingBag } from "lucide-react";
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
  format as formatDateFns, 
  isSameMonth,
  isSameYear,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DayProps } from "react-day-picker";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { CreditCardTransactionForm } from "@/components/credit-cards/CreditCardTransactionForm";

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

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expensesByCategory, setExpensesByCategory] = useState<CategoryExpense[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [userCreditCards, setUserCreditCards] = useState<CreditCard[]>([]);

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isCreditCardPurchaseModalOpen, setIsCreditCardPurchaseModalOpen] = useState(false);


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

  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setIsLoading(false); 
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [transactions, fetchedCreditCards, creditCardPurchases, loans] = await Promise.all([
        getTransactionsForUser(user.id),
        getCreditCardsForUser(user.id),
        getCreditCardPurchasesForUser(user.id),
        getLoansForUser(user.id),
      ]);
      setAllTransactions(transactions); 
      setUserCreditCards(fetchedCreditCards);

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
        if (isWithinInterval(selectedDate, { start: loanStartDate, end: loanEndDate })) {
          loanPaymentsThisMonth += loan.installmentAmount;
        }
      });
      
      const totalSelectedMonthExpenses = directMonthlyExpenses + ccBillsClosedLastMonth + loanPaymentsThisMonth;

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
  const selectedMonthNameCapitalized = selectedMonthName.charAt(0).toUpperCase() + selectedMonthName.slice(1);


  const summaryCardsData = [
    { title: "Saldo Atual", value: summary.balance, icon: DollarSign, currency: true, color: "text-primary" },
    { title: "Receitas", value: summary.selectedMonthIncome, icon: TrendingUp, currency: true, color: "text-positive" },
    { title: "Despesas", value: summary.selectedMonthExpenses, icon: TrendingDown, currency: true, color: "text-negative" },
    { title: "Cartões", value: summary.selectedMonthCardSpending, icon: CreditCardIcon, currency: true, color: "text-blue-500", link: "/credit-cards" },
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
      
       <div className="flex flex-row items-center justify-center sm:justify-end gap-2">
         <Button onClick={handleCurrentMonth} variant="secondary" size="icon" aria-label="Mês Atual" disabled={isCurrentMonthSelected()}>
            <CalendarClock />
          </Button>
          <Dialog open={isTransactionModalOpen} onOpenChange={setIsTransactionModalOpen}>
            <DialogTrigger asChild>
              <Button size="icon" aria-label="Nova Transação" disabled={!user}>
                <PlusCircle />
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
              <Button variant="outline" size="icon" aria-label="Nova Compra (Cartão)" disabled={!user || userCreditCards.length === 0}>
                <ShoppingBag/>
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
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline">Por Categoria</CardTitle>
            <CardDescription>Distribuição dos seus gastos mensais diretos (sem cartão, sem empréstimos).</CardDescription>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length > 0 ? (
              <ul className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {expensesByCategory.map((expense) => (
                  <li key={expense.category} className="flex justify-between items-center py-2 border-b last:border-b-0">
                    <span className="text-sm text-foreground">{expense.category}</span>
                    <span className="text-sm font-semibold text-negative">{formatCurrency(expense.total)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-[auto] min-h-[150px] flex items-center justify-center bg-muted/50 rounded-md p-4">
                <p className="text-muted-foreground text-center">
                  Nenhuma despesa direta registrada em {selectedMonthName.toLowerCase()} para exibir.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline">Calendário Financeiro</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            {allTransactions ? (
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

    </div>
  );
}

