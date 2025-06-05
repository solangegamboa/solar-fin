
'use client';

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PlusCircle, CreditCardIcon as CreditCardLucideIcon, CalendarDays, AlertTriangleIcon, SearchX, Loader2, ShoppingBag, Edit3, Trash2, TrendingUp, TrendingDown, FileText } from "lucide-react";
import { CreditCardForm } from "@/components/credit-cards/CreditCardForm";
import { CreditCardTransactionForm } from "@/components/credit-cards/CreditCardTransactionForm";
import { getCreditCardsForUser, getCreditCardPurchasesForUser } from "@/lib/databaseService";
import type { CreditCard, CreditCardPurchase } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { format, parseISO, addMonths, getMonth, getYear, getDate, setDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface MonthlySummary {
  monthYear: string; // "MMMM/yyyy" e.g. "junho/2025"
  totalAmount: number;
  purchases: Array<CreditCardPurchase & { installmentAmount: number; currentInstallment: number; totalInstallments: number }>;
}

// Correct Portuguese month names in lowercase, as produced by format(..., 'MMMM', { locale: ptBR })
const ptBRMonthNames = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

export default function CreditCardsPage() {
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [purchases, setPurchases] = useState<CreditCardPurchase[]>([]);
  
  const [isLoadingCards, setIsLoadingCards] = useState(true);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(true);
  
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchUserCreditCards = useCallback(async () => {
    setIsLoadingCards(true);
    setError(null);
    try {
      const userCreditCards = await getCreditCardsForUser();
      setCreditCards(userCreditCards);
    } catch (e: any) {
      const errorMessage = (e && typeof e.message === 'string') ? e.message : 'Falha ao carregar cartões.';
      console.error("Failed to fetch credit cards:", errorMessage);
      setError("Falha ao carregar cartões. Tente novamente.");
      toast({ variant: "destructive", title: "Erro", description: errorMessage });
    } finally {
      setIsLoadingCards(false);
    }
  }, [toast]);

  const fetchUserPurchases = useCallback(async () => {
    setIsLoadingPurchases(true);
    try {
      const userPurchases = await getCreditCardPurchasesForUser();
      setPurchases(userPurchases);
    } catch (e: any) {
      const errorMessage = (e && typeof e.message === 'string') ? e.message : 'Falha ao carregar compras.';
      console.error("Failed to fetch purchases:", errorMessage);
      toast({ variant: "destructive", title: "Erro", description: errorMessage });
    } finally {
      setIsLoadingPurchases(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUserCreditCards();
    fetchUserPurchases();
  }, [fetchUserCreditCards, fetchUserPurchases]);

  const handleCreditCardAdded = () => {
    setIsCardModalOpen(false);
    fetchUserCreditCards(); 
  };

  const handlePurchaseAdded = () => {
    setIsPurchaseModalOpen(false);
    fetchUserPurchases();
  };

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

  const calculateMonthlySummaries = useCallback((): MonthlySummary[] => {
    const summaries: { [key: string]: MonthlySummary } = {}; 
    if (!creditCards.length || !purchases.length) return [];

    purchases.forEach(purchase => {
      const card = creditCards.find(c => c.id === purchase.cardId);
      if (!card) return;

      const purchaseDate = parseISO(purchase.date);
      const installmentAmount = purchase.totalAmount / purchase.installments;

      for (let i = 0; i < purchase.installments; i++) {
        let paymentMonthDate = new Date(purchaseDate);
        
        if (purchaseDate.getDate() > card.closingDateDay) {
          paymentMonthDate = addMonths(purchaseDate, 1); 
        }
        paymentMonthDate = addMonths(paymentMonthDate, i);

        const monthYearSortKey = format(paymentMonthDate, 'yyyy-MM'); 
        const displayMonthYear = format(paymentMonthDate, 'MMMM/yyyy', { locale: ptBR });

        if (!summaries[monthYearSortKey]) {
          summaries[monthYearSortKey] = {
            monthYear: displayMonthYear,
            totalAmount: 0,
            purchases: [],
          };
        }
        summaries[monthYearSortKey].totalAmount += installmentAmount;
        summaries[monthYearSortKey].purchases.push({
          ...purchase,
          installmentAmount,
          currentInstallment: i + 1,
          totalInstallments: purchase.installments,
        });
      }
    });
    
    return Object.values(summaries).sort((a, b) => {
        const [aMonthName, aYearStr] = a.monthYear.split('/');
        const [bMonthName, bYearStr] = b.monthYear.split('/');
        const aYear = parseInt(aYearStr);
        const bYear = parseInt(bYearStr);
        const aMonthIndex = ptBRMonthNames.indexOf(aMonthName.toLowerCase());
        const bMonthIndex = ptBRMonthNames.indexOf(bMonthName.toLowerCase());

        if (aMonthIndex === -1 || bMonthIndex === -1) {
          console.error("Invalid month name found in summary:", aMonthName, bMonthName);
          return 0; 
        }
        const dateA = new Date(aYear, aMonthIndex, 1);
        const dateB = new Date(bYear, bMonthIndex, 1);
        return dateA.getTime() - dateB.getTime();
    });
  }, [purchases, creditCards]);

  const monthlySummaries = calculateMonthlySummaries();

  const renderCreditCardList = () => {
    if (isLoadingCards || (isLoadingPurchases && creditCards.length > 0)) { // Show loader if cards are loading OR purchases are loading but we have cards
      return <div className="flex items-center justify-center h-40 col-span-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Carregando cartões e faturas...</p></div>;
    }
    if (error && !creditCards.length) {
      return <div className="flex flex-col items-center justify-center h-40 text-destructive col-span-full"><AlertTriangleIcon className="h-8 w-8 mb-2" /><p>{error}</p></div>;
    }
    if (creditCards.length === 0) {
      return <div className="flex flex-col items-center justify-center h-40 col-span-full"><SearchX className="h-12 w-12 text-muted-foreground mb-4" /><p className="text-xl text-muted-foreground">Nenhum cartão de crédito encontrado.</p></div>;
    }

    const currentDate = new Date();
    const currentMonth = getMonth(currentDate);
    const currentYear = getYear(currentDate);
    
    const nextMonthDate = addMonths(currentDate, 1);
    const nextMonth = getMonth(nextMonthDate);
    const nextYear = getYear(nextMonthDate);

    return creditCards.map((card) => {
      const currentInvoiceTotal = calculateInvoiceTotalForCardAndMonth(card, purchases, currentMonth, currentYear);
      const nextInvoiceTotal = calculateInvoiceTotalForCardAndMonth(card, purchases, nextMonth, nextYear);
      
      const currentClosingDate = setDate(currentDate, card.closingDateDay);
      let nextClosingDate = addMonths(currentDate, 1);
      nextClosingDate = setDate(nextClosingDate, card.closingDateDay);

      return (
        <Card key={card.id} className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-xl"><CreditCardLucideIcon className="mr-2 h-6 w-6 text-primary" />{card.name}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Limite:</span><span className="font-semibold">{formatCurrency(card.limit)}</span></div>
            <div className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Vencimento: Dia</span><span className="font-medium ml-auto">{String(card.dueDateDay).padStart(2, '0')}</span></div>
            <div className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Fechamento: Dia</span><span className="font-medium ml-auto">{String(card.closingDateDay).padStart(2, '0')}</span></div>
            <Separator className="my-2"/>
            <div className="flex items-center justify-between">
              <div className="flex items-center text-sm text-muted-foreground">
                <FileText className="mr-2 h-4 w-4 text-blue-500" />
                <span>Fatura Atual (Fecha {format(currentClosingDate, 'dd/MM', { locale: ptBR })}):</span>
              </div>
              <span className="font-semibold text-blue-600">{formatCurrency(currentInvoiceTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center text-sm text-muted-foreground">
                <TrendingUp className="mr-2 h-4 w-4 text-green-500" />
                <span>Próxima Fatura (Fecha {format(nextClosingDate, 'dd/MM', { locale: ptBR })}):</span>
              </div>
              <span className="font-semibold text-green-600">{formatCurrency(nextInvoiceTotal)}</span>
            </div>
          </CardContent>
        </Card>
      );
    });
  };

  const renderPurchasesList = () => {
    if (isLoadingPurchases && purchases.length === 0) { 
      return <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Carregando compras...</p></div>;
    }
    if (!isLoadingPurchases && purchases.length === 0) {
      return <div className="flex flex-col items-center justify-center h-40"><SearchX className="h-12 w-12 text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhuma compra parcelada registrada.</p></div>;
    }
    return (
      <ul className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {purchases.map(p => {
          const cardName = creditCards.find(c => c.id === p.cardId)?.name || 'Cartão desconhecido';
          return (
            <li key={p.id} className="p-3 border rounded-md shadow-sm bg-card">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{p.description}</p>
                  <p className="text-xs text-muted-foreground">{p.category} - {cardName}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(p.totalAmount)}</p>
                  <p className="text-xs text-muted-foreground">{p.installments}x de {formatCurrency(p.totalAmount / p.installments)}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Comprado em: {format(parseISO(p.date), 'dd/MM/yyyy', { locale: ptBR })}</p>
            </li>
          );
        })}
      </ul>
    );
  }

  const renderMonthlySummary = () => {
    if ((isLoadingCards || isLoadingPurchases) && monthlySummaries.length === 0) {
         return <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Calculando resumos...</p></div>;
    }
    if (monthlySummaries.length === 0 && !isLoadingPurchases && !isLoadingCards) { // Only show 'no summary' if not loading and data is present
      return <div className="flex flex-col items-center justify-center h-40"><SearchX className="h-12 w-12 text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhuma fatura futura encontrada.</p></div>;
    }
    if (monthlySummaries.length === 0) { // Fallback for initial load or if there are truly no summaries
        return <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Calculando...</p></div>;
    }


    return (
      <Accordion type="single" collapsible className="w-full max-h-[400px] overflow-y-auto pr-2">
        {monthlySummaries.map(summary => (
          <AccordionItem value={summary.monthYear} key={summary.monthYear}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex justify-between w-full pr-2">
                <span className="font-semibold text-base">{summary.monthYear.charAt(0).toUpperCase() + summary.monthYear.slice(1)}</span>
                <Badge variant="secondary" className="text-base">{formatCurrency(summary.totalAmount)}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 pt-2">
                {summary.purchases.map(p => (
                  <li key={`${p.id}-${p.currentInstallment}`} className="p-2 border-b last:border-b-0">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium">{p.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {creditCards.find(c => c.id === p.cardId)?.name || 'Cartão'} - {p.category}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(p.installmentAmount)}</p>
                        <p className="text-xs text-muted-foreground">Parcela {p.currentInstallment}/{p.totalInstallments}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  }


  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Cartões de Crédito</h1>
          <p className="text-muted-foreground">Gerencie seus cartões e compras parceladas.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCardModalOpen} onOpenChange={setIsCardModalOpen}>
            <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" />Novo Cartão</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader><DialogTitle>Adicionar Novo Cartão</DialogTitle><DialogDescription>Preencha os detalhes do seu novo cartão.</DialogDescription></DialogHeader>
              <CreditCardForm onSuccess={handleCreditCardAdded} setOpen={setIsCardModalOpen} />
            </DialogContent>
          </Dialog>
          <Dialog open={isPurchaseModalOpen} onOpenChange={setIsPurchaseModalOpen}>
            <DialogTrigger asChild><Button variant="secondary" disabled={creditCards.length === 0}><ShoppingBag className="mr-2 h-4 w-4" />Nova Compra</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader><DialogTitle>Adicionar Compra Parcelada</DialogTitle><DialogDescription>Registre uma nova compra no cartão de crédito.</DialogDescription></DialogHeader>
              <CreditCardTransactionForm userCreditCards={creditCards} onSuccess={handlePurchaseAdded} setOpen={setIsPurchaseModalOpen} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <h2 className="text-2xl font-semibold tracking-tight font-headline border-b pb-2">Meus Cartões</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {renderCreditCardList()}
      </div>
      
      <Separator className="my-8" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
            <h2 className="text-2xl font-semibold tracking-tight font-headline mb-4">Compras Realizadas (Todas)</h2>
            {renderPurchasesList()}
        </div>
        <div>
            <h2 className="text-2xl font-semibold tracking-tight font-headline mb-4">Próximas Faturas (Estimativa Consolidada)</h2>
            {renderMonthlySummary()}
        </div>
      </div>

    </div>
  );
}
        