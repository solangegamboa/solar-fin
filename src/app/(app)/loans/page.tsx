
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/alert-dialog";
import { PlusCircle, Landmark, CalendarDays, Trash2, Sun, AlertTriangleIcon, SearchX, Info, TrendingUp, TrendingDown, CircleDollarSign, ReceiptText, Sigma, CalendarClock, Banknote, LayoutGrid } from "lucide-react";
import { LoanForm } from "@/components/loans/LoanForm";
import type { Loan } from "@/types";
import { getLoansForUser, deleteLoan } from "@/lib/databaseService";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn } from "@/lib/utils";
import { format, parseISO, isPast, isFuture, differenceInMonths, addMonths, getDaysInMonth, startOfMonth, endOfMonth, isSameMonth, isSameYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from "@/contexts/AuthContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


interface LoanProgressInfo {
  progress: number;
  status: string;
  monthsPassed: number;
  remainingMonths: number;
  totalInstallments: number;
  paidAmount: number;
  remainingAmount: number;
  totalLoanAmount: number;
  isUpcoming: boolean;
}

interface DebtByBank {
  bankName: string;
  totalRemaining: number;
  loanCount: number;
}

export default function LoansPage() {
  const { user, loading: authLoading } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [loanToEdit, setLoanToEdit] = useState<Loan | null>(null);
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const fetchUserLoans = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const userLoans = await getLoansForUser(user.id);
      setLoans(userLoans);
    } catch (e: any) {
      const errorMessage = (e && typeof e.message === 'string') ? e.message : 'Falha ao carregar empréstimos.';
      console.error("Failed to fetch loans:", errorMessage);
      setError("Falha ao carregar empréstimos. Tente novamente.");
      toast({ variant: "destructive", title: "Erro", description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    if (user && !authLoading) {
      fetchUserLoans();
    }
  }, [fetchUserLoans, user, authLoading]);

  const handleLoanAddedOrUpdated = () => {
    setIsModalOpen(false);
    setLoanToEdit(null);
    fetchUserLoans();
  };
  
  const openAddModal = () => {
    setLoanToEdit(null);
    setIsModalOpen(true);
  };

  const handleDeleteLoan = (loan: Loan) => {
    setLoanToDelete(loan);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDeleteLoan = async () => {
    if (!loanToDelete || !user) return;
    setIsDeletingId(loanToDelete.id);
    setShowDeleteConfirmDialog(false);

    try {
      const result = await deleteLoan(user.id, loanToDelete.id);
      if (result.success) {
        toast({
          title: 'Empréstimo Excluído!',
          description: 'O empréstimo foi excluído com sucesso.',
        });
        fetchUserLoans();
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao Excluir',
          description: result.error || 'Não foi possível excluir o empréstimo.',
        });
      }
    } catch (e: any) {
      const errorMessage = (e && typeof e.message === 'string') ? e.message : 'Ocorreu um erro desconhecido.';
      console.error('Error deleting loan:', errorMessage);
      toast({
        variant: 'destructive',
        title: 'Erro ao Excluir Empréstimo',
        description: 'Ocorreu um erro ao tentar excluir o empréstimo.',
      });
    } finally {
      setIsDeletingId(null);
      setLoanToDelete(null);
    }
  };
  
  const calculateLoanProgress = useCallback((loan: Loan): LoanProgressInfo => {
    const startDate = parseISO(loan.startDate);
    const endDate = parseISO(loan.endDate);
    const today = new Date();
    
    const totalInstallments = loan.installmentsCount;
    const totalLoanAmount = loan.installmentAmount * totalInstallments;
    let monthsPassed = 0;
    let status = "";
    let progress = 0;
    let isUpcoming = false;

    if (isFuture(startDate)) {
      status = "A iniciar";
      progress = 0;
      monthsPassed = 0;
      isUpcoming = true;
    } else if (isPast(endDate) || today > endDate) { 
      status = "Concluído";
      progress = 100;
      monthsPassed = totalInstallments;
    } else {
      status = "Em andamento";
      monthsPassed = differenceInMonths(today, startDate);
      const dayOfToday = today.getDate();
      const dayOfStartDate = startDate.getDate();
      
      if (dayOfToday >= dayOfStartDate || today > startDate) { 
        monthsPassed +=1;
      }
      monthsPassed = Math.max(0, Math.min(monthsPassed, totalInstallments));
      progress = (monthsPassed / totalInstallments) * 100;
    }
    
    const remainingMonths = Math.max(0, totalInstallments - monthsPassed);
    const paidAmount = loan.installmentAmount * monthsPassed;
    const remainingAmount = totalLoanAmount - paidAmount;

    return { 
      progress: Math.max(0, Math.min(100, progress)), 
      status, 
      monthsPassed, 
      remainingMonths, 
      totalInstallments,
      paidAmount: Math.max(0, paidAmount),
      remainingAmount: Math.max(0, Math.min(remainingAmount, totalLoanAmount)), // Ensure remainingAmount is not negative or greater than total
      totalLoanAmount,
      isUpcoming
    };
  }, []);

  const summaryData = useMemo(() => {
    let totalRemainingForAllLoans = 0;
    let totalNextMonthPayments = 0;
    const debtByBankMap = new Map<string, { totalRemaining: number; loanCount: number }>();
    const today = new Date();
    const nextMonthDate = addMonths(today, 1);

    loans.forEach(loan => {
      const progressInfo = calculateLoanProgress(loan);
      
      if (progressInfo.status !== "Concluído") {
        totalRemainingForAllLoans += progressInfo.remainingAmount;

        const bankEntry = debtByBankMap.get(loan.bankName) || { totalRemaining: 0, loanCount: 0 };
        bankEntry.totalRemaining += progressInfo.remainingAmount;
        bankEntry.loanCount += 1;
        debtByBankMap.set(loan.bankName, bankEntry);
      }

      if (progressInfo.status === "Em andamento") {
        const loanStartDate = parseISO(loan.startDate);
        const loanEndDate = parseISO(loan.endDate);
        
        // Check if any installment falls in the next calendar month
        const firstInstallmentDateForNextMonth = startOfMonth(nextMonthDate);
        const lastInstallmentDateForNextMonth = endOfMonth(nextMonthDate);

        // Simplified check: if the loan is active and its period overlaps with next month.
        // This assumes a payment is made every month the loan is active.
        if (loanStartDate <= lastInstallmentDateForNextMonth && loanEndDate >= firstInstallmentDateForNextMonth) {
            totalNextMonthPayments += loan.installmentAmount;
        }
      }
    });

    const debtByBankArray: DebtByBank[] = Array.from(debtByBankMap.entries()).map(
      ([bankName, data]) => ({
        bankName,
        totalRemaining: data.totalRemaining,
        loanCount: data.loanCount,
      })
    ).sort((a, b) => b.totalRemaining - a.totalRemaining);

    return { totalRemainingForAllLoans, totalNextMonthPayments, debtByBank: debtByBankArray };
  }, [loans, calculateLoanProgress]);


  if (authLoading || (isLoading && !loans.length)) { 
    return <div className="flex items-center justify-center h-64"><Sun className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Carregando...</p></div>;
  }

  const renderLoanList = () => {
    if (isLoading && loans.length === 0 && !authLoading) { 
      return <div className="flex items-center justify-center h-64 col-span-full"><Sun className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Carregando empréstimos...</p></div>;
    }
    if (error && !isLoading) {
      return <div className="flex flex-col items-center justify-center h-64 text-destructive col-span-full"><AlertTriangleIcon className="h-12 w-12 mb-3" /><p className="text-lg font-semibold">{error}</p></div>;
    }
    if (loans.length === 0 && !isLoading) {
      return <div className="flex flex-col items-center justify-center h-64 text-muted-foreground col-span-full"><SearchX className="h-12 w-12 mb-3" /><p className="text-lg">Nenhum empréstimo encontrado.</p><p className="text-sm">Adicione um novo empréstimo para começar.</p></div>;
    }

    return loans.map((loan) => {
      const { 
        progress, 
        status, 
        monthsPassed, 
        remainingMonths, 
        totalInstallments, 
        paidAmount, 
        remainingAmount, 
        totalLoanAmount,
        isUpcoming
      } = calculateLoanProgress(loan);
      const formattedStartDate = format(parseISO(loan.startDate), 'dd/MM/yyyy', { locale: ptBR });
      const formattedEndDate = format(parseISO(loan.endDate), 'dd/MM/yyyy', { locale: ptBR });

      return (
        <Card key={loan.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center text-lg font-semibold"><Landmark className="mr-2 h-5 w-5 text-primary" />{loan.bankName}</CardTitle>
                <CardDescription className="text-sm">{loan.description}</CardDescription>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90" onClick={() => handleDeleteLoan(loan)} disabled={isDeletingId === loan.id || !user}>
                  {isDeletingId === loan.id ? <Sun className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 flex-grow text-sm pb-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center"><ReceiptText className="mr-1.5 h-4 w-4 text-muted-foreground/70" />Valor Parcela:</span>
              <span className="font-medium">{formatCurrency(loan.installmentAmount)}</span>
            </div>
             <div className="space-y-1 pt-1">
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Progresso ({monthsPassed}/{totalInstallments})</span>
                <Badge variant={status === "Concluído" ? "default" : (status === "A iniciar" ? "outline" : "secondary")}
                       className={cn(
                          "text-xs",
                          status === "Concluído" && "bg-green-100 text-green-700 border-green-300 dark:bg-green-800/30 dark:text-green-300 dark:border-green-700",
                          status === "Em andamento" && "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-800/30 dark:text-yellow-300 dark:border-yellow-700",
                          status === "A iniciar" && "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-800/30 dark:text-blue-300 dark:border-blue-700"
                       )}
                >
                  {status}
                </Badge>
              </div>
              <Progress value={progress} className="h-1.5" 
                indicatorClassName={cn(
                  status === "Concluído" && "bg-green-500",
                  status === "Em andamento" && "bg-yellow-500",
                  status === "A iniciar" && "bg-blue-500",
                )}
              />
            </div>
            <Separator className="my-2" />
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                <div className="text-muted-foreground flex items-center"><CircleDollarSign className="mr-1.5 h-3.5 w-3.5 text-muted-foreground/70" />Total:</div>
                <div className="font-medium text-right">{formatCurrency(totalLoanAmount)}</div>

                <div className="text-muted-foreground flex items-center"><TrendingUp className="mr-1.5 h-3.5 w-3.5 text-green-500" />Pago:</div>
                <div className="font-medium text-green-600 text-right">{formatCurrency(paidAmount)}</div>

                <div className="text-muted-foreground flex items-center"><TrendingDown className="mr-1.5 h-3.5 w-3.5 text-orange-500" />Restante:</div>
                <div className="font-medium text-orange-600 text-right">{formatCurrency(remainingAmount)}</div>
            </div>
             <Separator className="my-2" />
             <div className="space-y-0.5 text-xs text-muted-foreground">
                <div className="flex items-center">
                    <CalendarDays className="mr-1.5 h-3 w-3.5 text-muted-foreground/70" />
                    <span>Início: {formattedStartDate}</span>
                </div>
                <div className="flex items-center">
                    <CalendarDays className="mr-1.5 h-3 w-3.5 text-muted-foreground/70" />
                    <span>Fim: {formattedEndDate}</span>
                </div>
            </div>
          </CardContent>
           <CardFooter className="text-xs text-muted-foreground pt-2 pb-3">
            <Info className="mr-1.5 h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
            {status !== "Concluído" && !isUpcoming && <span className="truncate">{remainingMonths} parcelas restantes. </span>}
            {isUpcoming && <span>Este empréstimo ainda não iniciou.</span>}
            {status === "Concluído" && <span>Este empréstimo foi totalmente pago.</span>}
          </CardFooter>
        </Card>
      );
    });
  };


  return (
    <TooltipProvider>
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Empréstimos</h1>
          <p className="text-muted-foreground">
            Acompanhe seus empréstimos e pagamentos.
          </p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddModal} className="w-full sm:w-auto" disabled={!user}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo Empréstimo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{loanToEdit ? "Editar Empréstimo" : "Adicionar Novo Empréstimo"}</DialogTitle>
              <DialogDescription>
                Preencha os detalhes do seu empréstimo. A data final será calculada automaticamente.
              </DialogDescription>
            </DialogHeader>
            {user && <LoanForm 
              onSuccess={handleLoanAddedOrUpdated} 
              setOpen={setIsModalOpen} 
              existingLoan={loanToEdit}
              userId={user.id}
            />}
          </DialogContent>
        </Dialog>
      </div>

      <h2 className="text-2xl font-semibold tracking-tight font-headline border-b pb-2 flex items-center">
        <LayoutGrid className="mr-3 h-6 w-6 text-primary" />
        Resumos Financeiros
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <CalendarClock className="mr-2 h-5 w-5 text-blue-500" />
              Pagamentos Próximo Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(summaryData.totalNextMonthPayments)}</p>
            <p className="text-xs text-muted-foreground">Soma das parcelas de empréstimos ativos com vencimento no próximo mês.</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <Banknote className="mr-2 h-5 w-5 text-destructive" />
              Dívida Total Restante
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(summaryData.totalRemainingForAllLoans)}</p>
            <p className="text-xs text-muted-foreground">Soma de todos os valores restantes a pagar dos empréstimos não concluídos.</p>
          </CardContent>
        </Card>
      </div>
      
      {summaryData.debtByBank.length > 0 && (
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline text-xl flex items-center"><Landmark className="mr-2 h-6 w-6 text-primary"/>Dívida Restante por Instituição</CardTitle>
                <CardDescription>Valores totais que ainda faltam pagar, agrupados por banco.</CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible className="w-full">
                    {summaryData.debtByBank.map((bankData, index) => (
                        <AccordionItem value={`bank-${index}`} key={bankData.bankName}>
                            <AccordionTrigger className="hover:no-underline">
                                <div className="flex justify-between w-full pr-2 items-center">
                                    <span className="font-semibold text-base">{bankData.bankName}</span>
                                    <div className="text-right">
                                      <Badge variant="secondary" className="text-base">{formatCurrency(bankData.totalRemaining)}</Badge>
                                      <p className="text-xs text-muted-foreground mt-0.5">{bankData.loanCount} empréstimo(s)</p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <ul className="space-y-1 pt-1 pl-2 text-sm">
                                    {loans.filter(l => l.bankName === bankData.bankName && calculateLoanProgress(l).status !== "Concluído").map(loan => {
                                        const progress = calculateLoanProgress(loan);
                                        return (
                                            <li key={loan.id} className="flex justify-between items-center py-1 border-b last:border-b-0">
                                                <span className="truncate pr-2" title={loan.description}>{loan.description}</span>
                                                <span className="font-medium text-orange-600 whitespace-nowrap">{formatCurrency(progress.remainingAmount)}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
      )}
      
      <Separator className="my-8" />

      <h2 className="text-2xl font-semibold tracking-tight font-headline border-b pb-2 flex items-center">
        <ReceiptText className="mr-3 h-6 w-6 text-primary" />
        Detalhes dos Empréstimos
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {renderLoanList()}
      </div>
      
      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o empréstimo "{loanToDelete?.description || 'selecionado'}" do banco "{loanToDelete?.bankName}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLoanToDelete(null)} disabled={!!isDeletingId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteLoan}
              disabled={!!isDeletingId || !user}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingId ? <Sun className="mr-2 h-4 w-4 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}

    
