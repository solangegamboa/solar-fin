
'use client';

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from 'next/navigation'; // Keep useRouter
import Link from 'next/link';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger, // Ensured this is imported
} from "@/components/ui/alert-dialog";
import { PlusCircle, CreditCardIcon as CreditCardLucideIcon, CalendarDays, AlertTriangleIcon, SearchX, Sun, ShoppingBag, Trash2, TrendingUp, TrendingDown, FileText, Edit3, ArrowLeft, BarChart3, ListTree, Filter } from "lucide-react";
import { CreditCardForm } from "@/components/credit-cards/CreditCardForm";
import { CreditCardTransactionForm } from "@/components/credit-cards/CreditCardTransactionForm";
import type { CreditCard, CreditCardPurchase } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn } from "@/lib/utils";
import { 
  format, 
  parseISO, 
  addMonths, 
  getMonth, 
  getYear, 
  getDate, 
  setDate,
  startOfMonth, 
  subMonths,    
  isSameMonth,  
  isSameYear,   
  isAfter,      
  isSameDay,
  isBefore  
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface MonthlySummary {
  monthYear: string; 
  totalAmount: number;
  purchases: Array<CreditCardPurchase & { installmentAmount: number; currentInstallment: number; totalInstallments: number }>;
}

type CategoryFilterMode = 'allTime' | 'currentInvoice';

const ptBRMonthNames = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

// Define props interface for the page component
interface CreditCardDetailPageProps {
  params: { cardId: string };
}

export default function CreditCardDetailPage({ params }: CreditCardDetailPageProps) {
  const cardId = params.cardId as string; // Use cardId from props
  const router = useRouter();
  const { user, loading: authLoading, getToken } = useAuth();
  const { toast } = useToast();

  const [cardDetails, setCardDetails] = useState<CreditCard | null>(null);
  const [cardPurchases, setCardPurchases] = useState<CreditCardPurchase[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditCardModalOpen, setIsEditCardModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false); 
  const [isEditPurchaseModalOpen, setIsEditPurchaseModalOpen] = useState(false); 
  const [purchaseToEdit, setPurchaseToEdit] = useState<CreditCardPurchase | null>(null);
  
  const [isDeletingPurchaseId, setIsDeletingPurchaseId] = useState<string | null>(null);
  const [showDeletePurchaseConfirmDialog, setShowDeletePurchaseConfirmDialog] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<CreditCardPurchase | null>(null);

  const [showDeleteCardConfirmDialog, setShowDeleteCardConfirmDialog] = useState(false);
  const [isDeletingCardId, setIsDeletingCardId] = useState<string | null>(null);

  const [categoryFilterMode, setCategoryFilterMode] = useState<CategoryFilterMode>('allTime');

  const fetchCardData = useCallback(async () => {
    if (!user || !cardId) return;
    setIsLoading(true);
    setError(null);
    const token = getToken();
    if (!token) {
      setError("Não autenticado.");
      setIsLoading(false);
      return;
    }

    try {
      const [cardsResponse, purchasesResponse] = await Promise.all([
        fetch('/api/credit-cards', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/credit-card-purchases', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const cardsData = await cardsResponse.json();
      const purchasesData = await purchasesResponse.json();

      if (cardsResponse.ok && cardsData.success) {
        const foundCard = cardsData.cards.find((c: CreditCard) => c.id === cardId);
        if (foundCard) {
          setCardDetails(foundCard);
        } else {
          setError("Cartão não encontrado.");
        }
      } else {
        setError(cardsData.message || "Falha ao carregar detalhes do cartão.");
      }

      if (purchasesResponse.ok && purchasesData.success) {
        setCardPurchases(purchasesData.purchases.filter((p: CreditCardPurchase) => p.cardId === cardId));
      } else {
        setError(prevError => prevError ? `${prevError} E falha ao carregar compras.` : (purchasesData.message || "Falha ao carregar compras."));
      }

    } catch (e: any) {
      const errorMessage = (e && typeof e.message === 'string') ? e.message : 'Erro desconhecido.';
      setError(`Falha ao carregar dados: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [cardId, user, getToken]);

  useEffect(() => {
    if (user && !authLoading && cardId) {
      fetchCardData();
    }
  }, [fetchCardData, user, authLoading, cardId]);

  const handleCardUpserted = () => {
    setIsEditCardModalOpen(false);
    fetchCardData(); 
  };

  const handlePurchaseUpserted = () => { 
    setIsPurchaseModalOpen(false);
    setIsEditPurchaseModalOpen(false);
    setPurchaseToEdit(null);
    fetchCardData(); 
  };
  
  const handleOpenEditPurchaseModal = (purchase: CreditCardPurchase) => {
    setPurchaseToEdit(purchase);
    setIsEditPurchaseModalOpen(true);
  };

  const calculateInvoiceTotalForCardAndMonth = useCallback(
    (
      card: CreditCard | null,
      allPurchases: CreditCardPurchase[],
      targetInvoiceClosingMonth: number, 
      targetInvoiceClosingYear: number
    ): number => {
      if (!card) return 0;
      let invoiceTotal = 0;
      
      allPurchases.forEach(purchase => {
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

  const calculateMonthlySummariesForThisCard = useCallback((): MonthlySummary[] => {
    const summaries: { [key: string]: MonthlySummary } = {}; 
    if (!cardDetails || !cardPurchases.length) return [];

    cardPurchases.forEach(purchase => {
      const purchaseDate = parseISO(purchase.date);
      const installmentAmount = purchase.totalAmount / purchase.installments;

      for (let i = 0; i < purchase.installments; i++) {
        let paymentMonthDate = new Date(purchaseDate);
        
        if (purchaseDate.getDate() > cardDetails.closingDateDay) {
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
        if (aMonthIndex === -1 || bMonthIndex === -1) return 0; 
        const dateA = new Date(aYear, aMonthIndex, 1);
        const dateB = new Date(bYear, bMonthIndex, 1);
        return dateA.getTime() - dateB.getTime();
    });
  }, [cardPurchases, cardDetails]);

  const allCalculatedSummariesForThisCard = calculateMonthlySummariesForThisCard();

  const currentDateForFilter = new Date();
  const startOfCurrentMonthForFilter = startOfMonth(currentDateForFilter);
  const startOfPreviousMonthForFilter = startOfMonth(subMonths(currentDateForFilter, 1));

  const monthlySummariesForThisCard = allCalculatedSummariesForThisCard.filter(summary => {
      const [monthName, yearStr] = summary.monthYear.split('/');
      const year = parseInt(yearStr);
      const monthIndex = ptBRMonthNames.indexOf(monthName.toLowerCase());
      if (monthIndex === -1) return false; 
      const summaryDate = startOfMonth(new Date(year, monthIndex, 1));
      const isPrev = isSameDay(summaryDate, startOfPreviousMonthForFilter);
      const isCurr = isSameDay(summaryDate, startOfCurrentMonthForFilter);
      const isFuture = isAfter(summaryDate, startOfCurrentMonthForFilter);
      return isPrev || isCurr || isFuture;
  });

  const handleDeleteCardPurchase = (purchase: CreditCardPurchase) => {
    setPurchaseToDelete(purchase);
    setShowDeletePurchaseConfirmDialog(true);
  };

  const confirmDeleteCardPurchase = async () => {
    if (!purchaseToDelete || !user) return;
    setIsDeletingPurchaseId(purchaseToDelete.id);
    const token = getToken();
    if (!token) {
        toast({ variant: "destructive", title: "Erro de Autenticação", description: "Sessão inválida." });
        setIsDeletingPurchaseId(null);
        return;
    }
    try {
      const response = await fetch(`/api/credit-card-purchases/${purchaseToDelete.id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Compra Excluída!', description: 'A compra foi excluída.' });
        handlePurchaseUpserted(); 
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.message || 'Não foi possível excluir a compra.' });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro de Rede', description: e.message || 'Falha ao excluir.' });
    } finally {
      setIsDeletingPurchaseId(null);
      setPurchaseToDelete(null);
      setShowDeletePurchaseConfirmDialog(false);
    }
  };

  const confirmDeleteCard = async () => {
    if (!cardDetails || !user) return;
    setIsDeletingCardId(cardDetails.id);
    const token = getToken();
    if (!token) {
        toast({ variant: "destructive", title: "Erro de Autenticação", description: "Sessão inválida." });
        setIsDeletingCardId(null);
        return;
    }
    try {
      const response = await fetch(`/api/credit-cards/${cardDetails.id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Cartão Excluído!', description: `O cartão "${cardDetails.name}" e suas compras foram excluídos.` });
        router.push('/credit-cards');
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.message || 'Não foi possível excluir o cartão.' });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro de Rede', description: e.message || 'Falha ao excluir.' });
    } finally {
      setIsDeletingCardId(null);
      setShowDeleteCardConfirmDialog(false);
    }
  };

  const categorySpendingSummaryForThisCard = useMemo(() => {
    if (isLoading || !cardDetails) return [];

    let purchasesToConsider = cardPurchases;

    if (categoryFilterMode === 'currentInvoice') {
      const today = new Date();
      // Correctly determine the current open invoice period
      let invoicePeriodStart: Date;
      let invoicePeriodEnd: Date;

      if (getDate(today) > cardDetails.closingDateDay) {
        // Past this month's closing day, so open invoice is for purchases made *after* this month's closing day
        // up to next month's closing day.
        invoicePeriodStart = setDate(today, cardDetails.closingDateDay); 
        invoicePeriodEnd = setDate(addMonths(today, 1), cardDetails.closingDateDay);
      } else {
        // Before this month's closing day, so open invoice is for purchases made *after* last month's closing day
        // up to this month's closing day.
        invoicePeriodStart = setDate(subMonths(today, 1), cardDetails.closingDateDay);
        invoicePeriodEnd = setDate(today, cardDetails.closingDateDay);
      }
      
      purchasesToConsider = cardPurchases.filter(p => {
        const purchaseDate = parseISO(p.date);
        // Purchases made ON invoicePeriodStart are part of previous invoice, so AFTER.
        // Purchases made ON invoicePeriodEnd are part of current invoice.
        return isAfter(purchaseDate, invoicePeriodStart) && (isBefore(purchaseDate, invoicePeriodEnd) || isSameDay(purchaseDate, invoicePeriodEnd));
      });
    }

    if (purchasesToConsider.length === 0 && categoryFilterMode === 'currentInvoice') {
        return []; 
    }
    if (purchasesToConsider.length === 0 && categoryFilterMode === 'allTime' && cardPurchases.length === 0) {
        return [];
    }

    const summary: Record<string, number> = purchasesToConsider.reduce((acc, purchase) => {
      acc[purchase.category] = (acc[purchase.category] || 0) + purchase.totalAmount;
      return acc;
    }, {} as Record<string, number>);

    const totalSpending = Object.values(summary).reduce((sum, amount) => sum + amount, 0);

    return Object.entries(summary)
      .map(([category, totalAmount]) => ({
        category,
        totalAmount,
        percentage: totalSpending > 0 ? (totalAmount / totalSpending) * 100 : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [cardPurchases, isLoading, cardDetails, categoryFilterMode]);


  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center h-64"><Sun className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Carregando detalhes do cartão...</p></div>;
  }

  if (error) {
    return <div className="flex flex-col items-center justify-center h-64 text-destructive"><AlertTriangleIcon className="h-12 w-12 mb-3" /><p>{error}</p><Button onClick={() => router.back()} variant="outline" className="mt-4">Voltar</Button></div>;
  }

  if (!cardDetails) {
    return <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><SearchX className="h-12 w-12 mb-3" /><p>Cartão não encontrado.</p><Button onClick={() => router.back()} variant="outline" className="mt-4">Voltar</Button></div>;
  }
  
  const currentDate = new Date();
  const currentMonth = getMonth(currentDate);
  const currentYear = getYear(currentDate);
  const nextMonthDate = addMonths(currentDate, 1);
  const nextMonth = getMonth(nextMonthDate);
  const nextYear = getYear(nextMonthDate);
  const currentInvoiceTotal = calculateInvoiceTotalForCardAndMonth(cardDetails, cardPurchases, currentMonth, currentYear);
  const nextInvoiceTotal = calculateInvoiceTotalForCardAndMonth(cardDetails, cardPurchases, nextMonth, nextYear);
  const currentClosingDate = setDate(currentDate, cardDetails.closingDateDay);
  let nextClosingDate = addMonths(currentDate, 1);
  nextClosingDate = setDate(nextClosingDate, cardDetails.closingDateDay);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => router.push('/credit-cards')} aria-label="Voltar para lista de cartões">
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-headline flex items-center">
                    <CreditCardLucideIcon className="mr-3 h-7 w-7 text-primary" />
                    {cardDetails.name}
                </h1>
                <p className="text-muted-foreground">Detalhes e transações do cartão.</p>
            </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Dialog open={isPurchaseModalOpen} onOpenChange={setIsPurchaseModalOpen}>
            <DialogTrigger asChild><Button size="sm" disabled={!user} className="w-full sm:w-auto"><ShoppingBag className="mr-2 h-4 w-4" />Nova Compra</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Adicionar Compra para {cardDetails.name}</DialogTitle><DialogDescription>Registre uma nova compra neste cartão.</DialogDescription></DialogHeader>
              {user && <CreditCardTransactionForm userCreditCards={[cardDetails]} onSuccess={handlePurchaseUpserted} setOpen={setIsPurchaseModalOpen} userId={user.id} existingPurchase={null} />}
            </DialogContent>
          </Dialog>
          <Dialog open={isEditCardModalOpen} onOpenChange={setIsEditCardModalOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline" className="w-full sm:w-auto" disabled={!user}><Edit3 className="mr-2 h-4 w-4" />Editar Cartão</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Editar Cartão</DialogTitle><DialogDescription>Atualize os detalhes deste cartão.</DialogDescription></DialogHeader>
              {user && <CreditCardForm onSuccess={handleCardUpserted} setOpen={setIsEditCardModalOpen} userId={user.id} existingCard={cardDetails}/>}
            </DialogContent>
          </Dialog>
           <AlertDialog open={showDeleteCardConfirmDialog} onOpenChange={setShowDeleteCardConfirmDialog}>
            <AlertDialogTrigger asChild>
                 <Button size="sm" variant="destructive" className="w-full sm:w-auto" disabled={isDeletingCardId === cardDetails.id || !user}><Trash2 className="mr-2 h-4 w-4" />Excluir Cartão</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Excluir Cartão</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir o cartão "{cardDetails.name}" e todas as suas compras associadas? Esta ação é irreversível.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={!!isDeletingCardId}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteCard} disabled={!!isDeletingCardId} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                         {isDeletingCardId ? <Sun className="mr-2 h-4 w-4 animate-spin"/> : null} Excluir
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
           </AlertDialog>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader><CardTitle className="text-xl">Informações do Cartão</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><span className="text-muted-foreground">Limite:</span><span className="font-semibold float-right">{formatCurrency(cardDetails.limit)}</span></div>
            <div><span className="text-muted-foreground">Vencimento:</span><span className="font-medium float-right">Dia {String(cardDetails.dueDateDay).padStart(2, '0')}</span></div>
            <div><span className="text-muted-foreground">Fechamento:</span><span className="font-medium float-right">Dia {String(cardDetails.closingDateDay).padStart(2, '0')}</span></div>
            <Separator className="sm:col-span-2 my-1"/>
            <div><span className="text-muted-foreground">Fatura Atual (Fecha {format(currentClosingDate, 'dd/MM', { locale: ptBR })}):</span><span className="font-semibold float-right text-blue-600">{formatCurrency(currentInvoiceTotal)}</span></div>
            <div><span className="text-muted-foreground">Próxima Fatura (Fecha {format(nextClosingDate, 'dd/MM', { locale: ptBR })}):</span><span className="font-semibold float-right text-green-600">{formatCurrency(nextInvoiceTotal)}</span></div>
        </CardContent>
      </Card>

      <Separator />
      
      <div className="flex flex-col sm:flex-row justify-between items-center mb-1">
        <h2 className="text-2xl font-semibold tracking-tight font-headline">Gastos por Categoria (Este Cartão)</h2>
        <div className="flex items-center space-x-2 mt-2 sm:mt-0">
            <Label htmlFor="category-filter-mode" className="text-sm text-muted-foreground">
                Todo o Período
            </Label>
            <Switch
                id="category-filter-mode"
                checked={categoryFilterMode === 'currentInvoice'}
                onCheckedChange={(checked) => setCategoryFilterMode(checked ? 'currentInvoice' : 'allTime')}
                aria-label="Alternar filtro de categoria entre todo o período e fatura aberta"
            />
            <Label htmlFor="category-filter-mode" className="text-sm text-muted-foreground">
                Fatura Aberta
            </Label>
        </div>
      </div>
      <Card className="shadow-lg">
        <CardContent className="pt-6">
            {(categoryFilterMode === 'allTime' && cardPurchases.length === 0) || (categoryFilterMode === 'currentInvoice' && categorySpendingSummaryForThisCard.length === 0 && purchasesToConsider.length === 0) ? (
                <p className="text-muted-foreground text-center py-4">
                    {categoryFilterMode === 'currentInvoice' 
                        ? "Nenhuma compra na fatura aberta para exibir o resumo por categoria."
                        : "Nenhuma compra registrada para este cartão."
                    }
                </p>
            ) : categorySpendingSummaryForThisCard.length === 0 ? (
                 <p className="text-muted-foreground text-center py-4">
                    Nenhum gasto na categoria selecionada.
                 </p>
            ) : (
                <ScrollArea className="h-[250px] pr-3">
                    <ul className="space-y-3">
                    {categorySpendingSummaryForThisCard.map(item => (
                        <li key={item.category} className="text-sm">
                        <div className="flex justify-between items-center mb-1">
                            <span className="font-medium truncate pr-2" title={item.category}>{item.category}</span>
                            <div className="flex items-baseline whitespace-nowrap">
                            <span className="font-semibold">{formatCurrency(item.totalAmount)}</span>
                            <span className="ml-1.5 text-xs text-muted-foreground">({item.percentage.toFixed(1)}%)</span>
                            </div>
                        </div>
                        <Progress value={item.percentage} className="h-1.5" />
                        </li>
                    ))}
                    </ul>
                </ScrollArea>
            )}
        </CardContent>
      </Card>
      
      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
            <h2 className="text-2xl font-semibold tracking-tight font-headline mb-4">Compras Realizadas (Este Cartão)</h2>
            {cardPurchases.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Nenhuma compra registrada para este cartão.</p>
            ) : (
                <ScrollArea className="h-[400px] pr-2">
                <ul className="space-y-3">
                    {cardPurchases.map(p => (
                    <li key={p.id} className="p-3 border rounded-md shadow-sm bg-card">
                        <div className="flex justify-between items-start">
                        <div>
                            <p className="font-medium">{p.description}</p>
                            <p className="text-xs text-muted-foreground">{p.category}</p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                            <div>
                            <p className="font-semibold">{formatCurrency(p.totalAmount)}</p>
                            <p className="text-xs text-muted-foreground">{p.installments}x de {formatCurrency(p.totalAmount / p.installments)}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleOpenEditPurchaseModal(p)} disabled={!!isDeletingPurchaseId || !user} aria-label="Editar compra" className="h-8 w-8 text-primary hover:text-primary/80 shrink-0"><Edit3 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCardPurchase(p)} disabled={isDeletingPurchaseId === p.id || !user} aria-label="Excluir compra" className="h-8 w-8 text-destructive hover:text-destructive/80 shrink-0">
                            {isDeletingPurchaseId === p.id ? <Sun className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                        </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Comprado em: {format(parseISO(p.date), 'dd/MM/yyyy', { locale: ptBR })}</p>
                    </li>
                    ))}
                </ul>
                </ScrollArea>
            )}
        </div>
        <div>
            <h2 className="text-2xl font-semibold tracking-tight font-headline mb-4">Próximas Faturas (Este Cartão)</h2>
            {monthlySummariesForThisCard.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Nenhuma fatura futura para este cartão.</p>
            ) : (
            <Accordion type="single" collapsible className="w-full max-h-[400px] overflow-y-auto pr-2">
                {monthlySummariesForThisCard.map(summary => (
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
                                <p className="text-xs text-muted-foreground">{p.category}</p>
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
            )}
        </div>
      </div>

      <Dialog open={isEditPurchaseModalOpen} onOpenChange={(isOpen) => { setIsEditPurchaseModalOpen(isOpen); if (!isOpen) setPurchaseToEdit(null); }}>
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Compra</DialogTitle><DialogDescription>Atualize os detalhes da compra no cartão {cardDetails.name}.</DialogDescription></DialogHeader>
          {user && purchaseToEdit && cardDetails && (<CreditCardTransactionForm userCreditCards={[cardDetails]} onSuccess={handlePurchaseUpserted} setOpen={setIsEditPurchaseModalOpen} userId={user.id} existingPurchase={purchaseToEdit} />)}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeletePurchaseConfirmDialog} onOpenChange={setShowDeletePurchaseConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir a compra "{purchaseToDelete?.description || 'selecionada'}"?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPurchaseToDelete(null)} disabled={!!isDeletingPurchaseId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCardPurchase} disabled={!!isDeletingPurchaseId || !user} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeletingPurchaseId ? <Sun className="mr-2 h-4 w-4 animate-spin" /> : null} Excluir Compra
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}


    