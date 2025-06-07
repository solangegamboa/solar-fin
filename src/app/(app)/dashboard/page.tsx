
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DollarSign, CreditCardIcon, TrendingUp, TrendingDown, Sun, AlertTriangleIcon, SearchX, ChevronLeft, ChevronRight, CalendarClock, PlusCircle, ShoppingBag, ListChecks, Clock, CheckCircle2, Minus, Info } from "lucide-react";
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
  isAfter,
  isSameDay,
  startOfDay,
  lastDayOfMonth,
  addDays,
  setDate,
  endOfDay, // Added for precision in some interval checks
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
import { useToast } from '@/hooks/use-toast'; 

interface DashboardSummary {
  balance: number;
  selectedMonthIncome: number;
  selectedMonthExpenses: number;
  selectedMonthCardSpending: number;
}

interface CategoryExpense {
  category: string;
  total: number;
  previousMonthTotal?: number;
  percentageChange?: number;
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
  const [allUserTransactions, setAllUserTransactions] = useState<Transaction[]>([]);
  const [projectedTransactionsForMonth, setProjectedTransactionsForMonth] = useState<ProjectedTransaction[]>([]);
  const [userCreditCards, setUserCreditCards] = useState<CreditCard[]>([]);
  const [spendingPaceAlert, setSpendingPaceAlert] = useState<{ message: string; type: 'warning' | 'info' } | null>(null);

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isCreditCardPurchaseModalOpen, setIsCreditCardPurchaseModalOpen] = useState(false);
  const { toast } = useToast(); 


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
          let billingCycleDateForInstallment = purchaseDate; 
          
          if (getDate(purchaseDate) > card.closingDateDay) {
            billingCycleDateForInstallment = addMonths(billingCycleDateForInstallment, 1);
          }
          billingCycleDateForInstallment = addMonths(billingCycleDateForInstallment, i); 
          
          const installmentInvoiceClosingMonth = getMonth(billingCycleDateForInstallment);
          const installmentInvoiceClosingYear = getYear(billingCycleDateForInstallment);

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
      if (isWithinInterval(originalDate, { start: periodStart, end: endOfDay(periodEnd) })) { // Use endOfDay for periodEnd
        occurrences.push(originalDate);
      }
      return occurrences;
    }

    let currentDate = originalDate;

    if (transaction.recurrenceFrequency !== 'none') {
        while (isBefore(currentDate, periodStart) && isBefore(currentDate, addYears(periodEnd,1))) { 
            const nextDate = new Date(currentDate);
            let advanced = false;
            switch (transaction.recurrenceFrequency) {
                case 'monthly':
                    currentDate = addMonths(nextDate, 1);
                    const dayOfMonth = getDate(originalDate);
                    const lastDay = getDate(lastDayOfMonth(currentDate));
                    currentDate = new Date(getYear(currentDate), getMonth(currentDate), Math.min(dayOfMonth, lastDay));
                    advanced = true;
                    break;
                case 'weekly':
                    currentDate = addWeeks(nextDate, 1);
                    advanced = true;
                    break;
                case 'annually':
                    currentDate = addYears(nextDate, 1);
                    const annualDay = getDate(originalDate);
                    const annualMonth = getMonth(originalDate);
                    currentDate = new Date(getYear(currentDate), annualMonth, Math.min(annualDay, getDate(lastDayOfMonth(currentDate))));
                    advanced = true;
                    break;
            }
             if (!advanced || (currentDate <= nextDate && transaction.recurrenceFrequency !== 'none')) { 
                break;
            }
        }
    }


    while (isBefore(currentDate, endOfDay(periodEnd)) || isSameDay(currentDate, periodEnd)) { // Use endOfDay
      if (isWithinInterval(currentDate, { start: periodStart, end: endOfDay(periodEnd) })) {
        occurrences.push(new Date(currentDate)); 
      }

      const prevIterDate = new Date(currentDate);
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
          const annualDay = getDate(originalDate);
          const annualMonth = getMonth(originalDate);
          currentDate = new Date(getYear(currentDate), annualMonth, Math.min(annualDay, getDate(lastDayOfMonth(currentDate))));
          break;
        default: 
          return occurrences; 
      }
       if (currentDate <= prevIterDate) break; 
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
    setSpendingPaceAlert(null);

    try {
      const [fetchedTransactions, fetchedCreditCards, creditCardPurchases, loans] = await Promise.all([
        getTransactionsForUser(user.id),
        getCreditCardsForUser(user.id),
        getCreditCardPurchasesForUser(user.id),
        getLoansForUser(user.id),
      ]);
      setAllUserTransactions(fetchedTransactions);
      setUserCreditCards(fetchedCreditCards);

      let baseLifetimeBalance = 0;
      fetchedTransactions.forEach(tx => {
        if (tx.type === 'income') baseLifetimeBalance += tx.amount;
        else baseLifetimeBalance -= tx.amount;
      });

      const selectedMonthStart = startOfMonth(selectedDate);
      const selectedMonthEnd = endOfMonth(selectedDate);
      const today = startOfDay(new Date());

      let projectedMonthIncome = 0;
      let projectedMonthExpenses = 0;
      const currentProjectedTransactions: ProjectedTransaction[] = [];
      const selectedMonthExpensesByCategory: { [key: string]: number } = {};
      const previousMonthExpensesByCategory: { [key: string]: number } = {};
      
      const previousSelectedMonthStart = startOfMonth(subMonths(selectedDate, 1));
      const previousSelectedMonthEnd = endOfMonth(subMonths(selectedDate, 1));

      fetchedTransactions.forEach(tx => {
        const occurrencesSelectedMonth = getProjectedOccurrences(tx, selectedMonthStart, selectedMonthEnd);
        occurrencesSelectedMonth.forEach(occDate => {
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

        if (tx.type === 'expense') {
            const occurrencesPreviousMonth = getProjectedOccurrences(tx, previousSelectedMonthStart, previousSelectedMonthEnd);
            occurrencesPreviousMonth.forEach(_ => { 
                previousMonthExpensesByCategory[tx.category] = (previousMonthExpensesByCategory[tx.category] || 0) + tx.amount;
            });
        }
      });
      
      fetchedCreditCards.forEach(card => {
        const prevMonthForClosing = subMonths(selectedDate, 1); 
        const targetClosingMonth = getMonth(prevMonthForClosing);
        const targetClosingYear = getYear(prevMonthForClosing);

        const cardInvoiceTotalForSelectedMonth = calculateInvoiceTotalForCardAndMonth(
          card,
          creditCardPurchases,
          targetClosingMonth, 
          targetClosingYear  
        );

        if (cardInvoiceTotalForSelectedMonth > 0) {
          const dueDateInSelectedMonth = setDate(selectedDate, Math.min(card.dueDateDay, getDate(lastDayOfMonth(selectedDate))));
          
          if (isSameMonth(dueDateInSelectedMonth, selectedDate) && isSameYear(dueDateInSelectedMonth, selectedDate)) {
            currentProjectedTransactions.push({
              id: `cc-bill-${card.id}-${formatDateFns(selectedDate, 'yyyy-MM')}`,
              userId: user.id,
              type: 'expense',
              amount: cardInvoiceTotalForSelectedMonth,
              category: 'Fatura Cartão',
              date: formatDateFns(dueDateInSelectedMonth, 'yyyy-MM-dd'),
              description: `Pagamento Fatura ${card.name}`,
              recurrenceFrequency: 'none',
              projectedDate: startOfDay(dueDateInSelectedMonth),
              isPast: isBefore(startOfDay(dueDateInSelectedMonth), today) && !isSameDay(startOfDay(dueDateInSelectedMonth), today),
              createdAt: selectedMonthStart.getTime(), 
              receiptImageUri: null, 
            });
          }
        }
      });

      loans.forEach(loan => {
        const loanStartDate = parseISO(loan.startDate);
        const loanEndDate = parseISO(loan.endDate);

        if (isWithinInterval(selectedMonthStart, { start: loanStartDate, end: loanEndDate }) || 
            isWithinInterval(selectedMonthEnd, { start: loanStartDate, end: loanEndDate }) ||
            (isBefore(loanStartDate, selectedMonthStart) && isAfter(loanEndDate, selectedMonthEnd))) {
            
            for (let i = 0; i < loan.installmentsCount; i++) {
                let installmentBaseDate = addMonths(loanStartDate, i);
                const dayOfOriginalStart = getDate(loanStartDate);
                const lastDayOfInstallmentMonth = getDate(lastDayOfMonth(installmentBaseDate));
                const actualPaymentDayInInstallmentMonth = Math.min(dayOfOriginalStart, lastDayOfInstallmentMonth);
                
                let paymentDateForThisInstallment = new Date(
                    getYear(installmentBaseDate), 
                    getMonth(installmentBaseDate), 
                    actualPaymentDayInInstallmentMonth
                );
                paymentDateForThisInstallment = startOfDay(paymentDateForThisInstallment);


                if (isSameMonth(paymentDateForThisInstallment, selectedDate) && isSameYear(paymentDateForThisInstallment, selectedDate)) {
                    currentProjectedTransactions.push({
                        id: `loan-pmt-${loan.id}-${formatDateFns(paymentDateForThisInstallment, 'yyyy-MM-dd')}`,
                        userId: user.id,
                        type: 'expense',
                        amount: loan.installmentAmount,
                        category: 'Empréstimo',
                        date: formatDateFns(paymentDateForThisInstallment, 'yyyy-MM-dd'), // Use the actual payment date as base for display if needed
                        description: `Parcela Empréstimo ${loan.bankName} (${loan.description})`,
                        recurrenceFrequency: 'none', 
                        projectedDate: paymentDateForThisInstallment,
                        isPast: isBefore(paymentDateForThisInstallment, today) && !isSameDay(paymentDateForThisInstallment, today),
                        createdAt: selectedMonthStart.getTime(),
                        receiptImageUri: null,
                    });
                    break; 
                }
                 if (isAfter(paymentDateForThisInstallment, selectedMonthEnd) && getMonth(paymentDateForThisInstallment) > getMonth(selectedDate) ) break;
            }
        }
      });


      currentProjectedTransactions.sort((a, b) => a.projectedDate.getTime() - b.projectedDate.getTime());
      setProjectedTransactionsForMonth(currentProjectedTransactions);
      setIsLoadingProjections(false);

      const formattedExpensesByCategory: CategoryExpense[] = Object.entries(selectedMonthExpensesByCategory)
        .map(([category, total]) => {
            const prevTotal = previousMonthExpensesByCategory[category] || 0;
            let percentageChange: number | undefined = undefined;
            if (prevTotal > 0) {
                percentageChange = ((total - prevTotal) / prevTotal) * 100;
            } else if (total > 0) {
                percentageChange = Infinity;
            }
            return { category, total, previousMonthTotal: prevTotal, percentageChange };
        })
        .sort((a, b) => b.total - a.total);
      setExpensesByCategory(formattedExpensesByCategory);

      const monthBeforeSelected = subMonths(selectedDate, 1);
      const targetPrevMonthClosingMonth = getMonth(monthBeforeSelected);
      const targetPrevMonthClosingYear = getYear(monthBeforeSelected);
      let ccBillsClosedLastMonthForSelected = 0;
      fetchedCreditCards.forEach(card => {
        ccBillsClosedLastMonthForSelected += calculateInvoiceTotalForCardAndMonth(
          card,
          creditCardPurchases,
          targetPrevMonthClosingMonth,
          targetPrevMonthClosingYear
        );
      });

      let loanPaymentsForSelectedMonth = 0;
      loans.forEach(loan => {
        const loanStartDate = parseISO(loan.startDate);
        const loanEndDate = parseISO(loan.endDate);
        if (isWithinInterval(selectedMonthStart, { start: loanStartDate, end: loanEndDate }) || 
            isWithinInterval(selectedMonthEnd, { start: loanStartDate, end: loanEndDate }) ||
            (isBefore(loanStartDate, selectedMonthStart) && isAfter(loanEndDate, selectedMonthEnd))) {
            for (let i = 0; i < loan.installmentsCount; i++) {
                const installmentBaseDate = addMonths(loanStartDate, i);
                const dayOfOriginalStart = getDate(loanStartDate);
                const lastDayOfInstallmentMonth = getDate(lastDayOfMonth(installmentBaseDate));
                const actualPaymentDayInInstallmentMonth = Math.min(dayOfOriginalStart, lastDayOfInstallmentMonth);
                const paymentDateForThisInstallment = new Date(getYear(installmentBaseDate), getMonth(installmentBaseDate), actualPaymentDayInInstallmentMonth);

                if (isSameMonth(paymentDateForThisInstallment, selectedDate) && isSameYear(paymentDateForThisInstallment, selectedDate)) {
                    loanPaymentsForSelectedMonth += loan.installmentAmount;
                    break; 
                }
                if (isAfter(paymentDateForThisInstallment, selectedMonthEnd) && getMonth(paymentDateForThisInstallment) > getMonth(selectedDate)) break;
            }
        }
      });

      const totalSelectedMonthExpensesWithLoansAndOldCC = projectedMonthExpenses + ccBillsClosedLastMonthForSelected + loanPaymentsForSelectedMonth;


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

      // Calculate for "Saldo Atual (Real)" card - based on actual current month
      const actualCurrentDate = new Date();
      const actualCurrentMonthStart = startOfMonth(actualCurrentDate);
      const actualCurrentMonthEnd = endOfMonth(actualCurrentDate);
      
      let loanPaymentsDueInActualCurrentMonth = 0;
      loans.forEach(loan => {
        const loanStartDate = parseISO(loan.startDate);
        const loanEndDate = parseISO(loan.endDate);
         if (isWithinInterval(actualCurrentMonthStart, { start: loanStartDate, end: loanEndDate }) || 
            isWithinInterval(actualCurrentMonthEnd, { start: loanStartDate, end: loanEndDate }) ||
            (isBefore(loanStartDate, actualCurrentMonthStart) && isAfter(loanEndDate, actualCurrentMonthEnd))) {
            for (let i = 0; i < loan.installmentsCount; i++) {
                const installmentBaseDate = addMonths(loanStartDate, i);
                const dayOfOriginalStart = getDate(loanStartDate);
                const lastDayOfInstallmentMonth = getDate(lastDayOfMonth(installmentBaseDate));
                const actualPaymentDayInInstallmentMonth = Math.min(dayOfOriginalStart, lastDayOfInstallmentMonth);
                const paymentDateForThisInstallment = new Date(getYear(installmentBaseDate), getMonth(installmentBaseDate), actualPaymentDayInInstallmentMonth);

                if (isSameMonth(paymentDateForThisInstallment, actualCurrentDate) && isSameYear(paymentDateForThisInstallment, actualCurrentDate)) {
                    loanPaymentsDueInActualCurrentMonth += loan.installmentAmount;
                    break; 
                }
                if (isAfter(paymentDateForThisInstallment, actualCurrentMonthEnd) && getMonth(paymentDateForThisInstallment) > getMonth(actualCurrentDate)) break;
            }
        }
      });
      
      const actualPreviousMonth = subMonths(actualCurrentDate, 1);
      const actualPreviousMonthClosingMonth = getMonth(actualPreviousMonth);
      const actualPreviousMonthClosingYear = getYear(actualPreviousMonth);
      let ccBillsClosedPreviousActualMonth = 0;
      fetchedCreditCards.forEach(card => {
        ccBillsClosedPreviousActualMonth += calculateInvoiceTotalForCardAndMonth(
            card,
            creditCardPurchases,
            actualPreviousMonthClosingMonth,
            actualPreviousMonthClosingYear
        );
      });

      let directRecurringExpensesForActualCurrentMonth = 0;
      fetchedTransactions.forEach(tx => {
        if (tx.type === 'expense' && tx.recurrenceFrequency && tx.recurrenceFrequency !== 'none') {
          const occurrences = getProjectedOccurrences(tx, actualCurrentMonthStart, actualCurrentMonthEnd);
          occurrences.forEach(() => {
            directRecurringExpensesForActualCurrentMonth += tx.amount;
          });
        }
      });

      setSummary({
        balance: baseLifetimeBalance - loanPaymentsDueInActualCurrentMonth - ccBillsClosedPreviousActualMonth - directRecurringExpensesForActualCurrentMonth,
        selectedMonthIncome: projectedMonthIncome,
        selectedMonthExpenses: totalSelectedMonthExpensesWithLoansAndOldCC,
        selectedMonthCardSpending: cardSpendingForSelectedMonthBills,
      });

      if (isSameMonth(selectedDate, today) && isSameYear(selectedDate, today) && getDate(today) > 1) {
        const daysIntoMonth = getDate(today);
        const currentPeriodStart = startOfMonth(today);
        const currentPeriodEnd = today;

        const prevMonthDate = subMonths(today, 1);
        const prevMonthPeriodStart = startOfMonth(prevMonthDate);
        const lastDayOfPrevMonth = getDate(lastDayOfMonth(prevMonthDate));
        const prevMonthPeriodEnd = setDate(prevMonthDate, Math.min(daysIntoMonth, lastDayOfPrevMonth));

        let currentMonthPaceExpenses = 0;
        fetchedTransactions.forEach(tx => {
          const txDate = parseISO(tx.date);
          if (tx.type === 'expense' && isWithinInterval(txDate, { start: currentPeriodStart, end: currentPeriodEnd }) && (!tx.recurrenceFrequency || tx.recurrenceFrequency === 'none')) {
            currentMonthPaceExpenses += tx.amount;
          }
        });
        let ccSpendingCurrentPace = 0;
        fetchedCreditCards.forEach(card => {
          creditCardPurchases.filter(p => p.cardId === card.id).forEach(purchase => {
            const purchaseDate = parseISO(purchase.date);
            const installmentAmount = purchase.totalAmount / purchase.installments;
            let firstBillCycleDate = purchaseDate;
            if (getDate(purchaseDate) > card.closingDateDay) {
                firstBillCycleDate = addMonths(purchaseDate, 1);
            }
            
            for (let i = 0; i < purchase.installments; i++) {
                const installmentBillCycleDate = addMonths(firstBillCycleDate, i);
                if (getMonth(installmentBillCycleDate) === getMonth(currentPeriodStart) && getYear(installmentBillCycleDate) === getYear(currentPeriodStart)) {
                    if(isWithinInterval(purchaseDate, {start: currentPeriodStart, end: currentPeriodEnd})) {
                         ccSpendingCurrentPace += installmentAmount;
                    }
                }
            }
          });
        });
        currentMonthPaceExpenses += ccSpendingCurrentPace;


        let prevMonthPaceExpenses = 0;
        fetchedTransactions.forEach(tx => {
          const txDate = parseISO(tx.date);
          if (tx.type === 'expense' && isWithinInterval(txDate, { start: prevMonthPeriodStart, end: prevMonthPeriodEnd }) && (!tx.recurrenceFrequency || tx.recurrenceFrequency === 'none')) {
            prevMonthPaceExpenses += tx.amount;
          }
        });
        let ccSpendingPrevPace = 0;
         fetchedCreditCards.forEach(card => {
          creditCardPurchases.filter(p => p.cardId === card.id).forEach(purchase => {
            const purchaseDate = parseISO(purchase.date);
            const installmentAmount = purchase.totalAmount / purchase.installments;
            let firstBillCycleDate = purchaseDate;
            if (getDate(purchaseDate) > card.closingDateDay) {
                firstBillCycleDate = addMonths(purchaseDate, 1);
            }
            for (let i = 0; i < purchase.installments; i++) {
                const installmentBillCycleDate = addMonths(firstBillCycleDate, i);
                 if (getMonth(installmentBillCycleDate) === getMonth(prevMonthPeriodStart) && getYear(installmentBillCycleDate) === getYear(prevMonthPeriodStart)) {
                     if(isWithinInterval(purchaseDate, {start: prevMonthPeriodStart, end: prevMonthPeriodEnd})) {
                        ccSpendingPrevPace += installmentAmount;
                     }
                }
            }
          });
        });
        prevMonthPaceExpenses += ccSpendingPrevPace;


        if (prevMonthPaceExpenses > 0 && currentMonthPaceExpenses > (prevMonthPaceExpenses * 1.3)) {
          const percentageIncrease = ((currentMonthPaceExpenses - prevMonthPaceExpenses) / prevMonthPaceExpenses) * 100;
          setSpendingPaceAlert({
            message: `Suas despesas até o dia ${daysIntoMonth} deste mês (${formatCurrency(currentMonthPaceExpenses)}) estão ${percentageIncrease.toFixed(0)}% maiores que no mesmo período do mês passado (${formatCurrency(prevMonthPaceExpenses)}).`,
            type: 'warning',
          });
        } else if (prevMonthPaceExpenses > 0 && currentMonthPaceExpenses < (prevMonthPaceExpenses * 0.7) && currentMonthPaceExpenses > 0) {
           const percentageDecrease = ((prevMonthPaceExpenses - currentMonthPaceExpenses) / prevMonthPaceExpenses) * 100;
           setSpendingPaceAlert({
            message: `Bom trabalho! Suas despesas até o dia ${daysIntoMonth} deste mês (${formatCurrency(currentMonthPaceExpenses)}) estão ${percentageDecrease.toFixed(0)}% menores que no mesmo período do mês passado (${formatCurrency(prevMonthPaceExpenses)}).`,
            type: 'info',
          });
        }
      }


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

  useEffect(() => {
    if (!user || !projectedTransactionsForMonth.length || isLoadingProjections) {
      return;
    }
    
    const checkNotifications = () => {
      const today = startOfDay(new Date());
      const tomorrow = addDays(today, 1);

      const upcomingForTomorrow = projectedTransactionsForMonth.filter(tx =>
        !tx.isPast && isSameDay(startOfDay(tx.projectedDate), tomorrow)
      );

      if (upcomingForTomorrow.length > 0) {
        const notificationDateKey = formatDateFns(today, 'yyyy-MM-dd');
        const storageKey = `notifiedUpcomingTxDay_${user.id}_${notificationDateKey}`;
        
        try {
            const alreadyNotifiedToday = localStorage.getItem(storageKey);

            if (!alreadyNotifiedToday) {
            upcomingForTomorrow.forEach(tx => {
                toast({
                title: 'Lembrete: Transação Agendada',
                description: (
                    <div className="flex items-start gap-2">
                    <CalendarClock className="h-5 w-5 text-primary mt-0.5" />
                    <span>
                        {tx.description || tx.category} ({formatCurrency(tx.amount)}) está agendada para amanhã, {formatDateFns(tx.projectedDate, 'dd/MM/yyyy', { locale: ptBR })}.
                    </span>
                    </div>
                ),
                duration: 10000,
                });
            });
            localStorage.setItem(storageKey, 'true');
            }
        } catch (e) {
            console.warn("LocalStorage not available for notifications:", e);
        }
      }

      try {
        const todayFormatted = formatDateFns(today, 'yyyy-MM-dd');
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`notifiedUpcomingTxDay_${user.id}_`)) {
            if (!key.endsWith(todayFormatted)) {
              localStorage.removeItem(key);
            }
          }
        }
      } catch (e) {
        console.warn("Could not clean up localStorage for notifications:", e);
      }
    };

    const timerId = setTimeout(checkNotifications, 500);
    return () => clearTimeout(timerId);

  }, [projectedTransactionsForMonth, user, isLoadingProjections, toast]);


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
              {formatDateFns(selectedDate, 'MMMM/yyyy', { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())}
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

      {spendingPaceAlert && (
        <Alert variant={spendingPaceAlert.type} className="mb-6 shadow-md">
          {spendingPaceAlert.type === 'warning' && <AlertTriangleIcon className="h-5 w-5" />}
          {spendingPaceAlert.type === 'info' && <Info className="h-5 w-5" />}
          <AlertTitle className="font-semibold">
            {spendingPaceAlert.type === 'warning' ? "Atenção ao Ritmo de Gastos!" : "Informação sobre seu Ritmo de Gastos"}
          </AlertTitle>
          <AlertDescription>
            {spendingPaceAlert.message}
          </AlertDescription>
        </Alert>
      )}


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
            <CardTitle className="font-headline">Análise de Despesas ({selectedMonthName.replace(/^\w/, (c) => c.toUpperCase())})</CardTitle>
            <CardDescription>Comparativo com o mês anterior.</CardDescription>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length > 0 ? (
              <ScrollArea className="h-[300px] pr-3">
                <ul className="space-y-2">
                  {expensesByCategory.map((expense) => (
                    <li key={expense.category} className="py-2 border-b last:border-b-0">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-foreground truncate pr-2" title={expense.category}>{expense.category}</span>
                        <span className="text-sm font-semibold text-negative whitespace-nowrap">{formatCurrency(expense.total)}</span>
                      </div>
                      {expense.previousMonthTotal !== undefined && (
                        <div className="flex justify-between items-center text-xs mt-0.5">
                          <span className="text-muted-foreground">Mês Anterior: {formatCurrency(expense.previousMonthTotal)}</span>
                           {expense.percentageChange !== undefined && expense.percentageChange !== Infinity && (
                            <span className={cn(
                              "font-medium flex items-center",
                              expense.percentageChange > 5 ? "text-red-500" :
                              expense.percentageChange < -5 ? "text-green-500" :
                              "text-muted-foreground"
                            )}>
                              {expense.percentageChange > 0 && <TrendingUp className="h-3 w-3 mr-0.5" />}
                              {expense.percentageChange < 0 && <TrendingDown className="h-3 w-3 mr-0.5" />}
                              {expense.percentageChange === 0 && <Minus className="h-3 w-3 mr-0.5" />}
                              {expense.percentageChange.toFixed(0)}%
                            </span>
                          )}
                          {expense.percentageChange === Infinity && (
                             <span className="font-medium text-red-500 flex items-center">
                                <TrendingUp className="h-3 w-3 mr-0.5" /> Novo Gasto
                             </span>
                          )}
                        </div>
                      )}
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
            <CardTitle className="font-headline flex items-center"><ListChecks className="mr-2 h-6 w-6 text-primary"/>Agendamentos para {selectedMonthName.replace(/^\w/, (c) => c.toUpperCase())}</CardTitle>
            <CardDescription>Transações recorrentes, faturas e parcelas previstas para este mês.</CardDescription>
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
                    Nenhum agendamento para {selectedMonthName.toLowerCase()}.
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

