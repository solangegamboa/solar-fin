
'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { PlusCircle, Landmark, CalendarDays, Trash2, Loader2, AlertTriangleIcon, SearchX, Edit3, TrendingUp, TrendingDown, CircleDollarSign, ReceiptText, Info } from "lucide-react";
import { LoanForm } from "@/components/loans/LoanForm";
import type { Loan } from "@/types";
import { getLoansForUser, deleteLoan } from "@/lib/databaseService";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { format, parseISO, isPast, isFuture, differenceInMonths, addMonths, getDaysInMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


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


export default function LoansPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [loanToEdit, setLoanToEdit] = useState<Loan | null>(null); // Editing not implemented yet
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const fetchUserLoans = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const userLoans = await getLoansForUser();
      setLoans(userLoans);
    } catch (e: any) {
      const errorMessage = (e && typeof e.message === 'string') ? e.message : 'Falha ao carregar empréstimos.';
      console.error("Failed to fetch loans:", errorMessage);
      setError("Falha ao carregar empréstimos. Tente novamente.");
      toast({ variant: "destructive", title: "Erro", description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUserLoans();
  }, [fetchUserLoans]);

  const handleLoanAddedOrUpdated = () => {
    setIsModalOpen(false);
    setLoanToEdit(null);
    fetchUserLoans();
  };
  
  const openAddModal = () => {
    setLoanToEdit(null); // Ensure we are adding, not editing
    setIsModalOpen(true);
  };

  const handleDeleteLoan = (loan: Loan) => {
    setLoanToDelete(loan);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDeleteLoan = async () => {
    if (!loanToDelete) return;
    setIsDeletingId(loanToDelete.id);
    setShowDeleteConfirmDialog(false);

    try {
      const result = await deleteLoan(loanToDelete.id);
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
  
  const calculateLoanProgress = (loan: Loan): LoanProgressInfo => {
    const startDate = parseISO(loan.startDate);
    const endDate = parseISO(loan.endDate); // This is now the calculated end date
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
    } else if (isPast(endDate)) {
      status = "Concluído";
      progress = 100;
      monthsPassed = totalInstallments;
    } else {
      status = "Em andamento";
      // Calculate months passed since the start date up to today
      // Ensure today's month is counted if the start date's day has passed or is today
      monthsPassed = differenceInMonths(today, startDate);
      const dayOfToday = today.getDate();
      const dayOfStartDate = startDate.getDate();
      
      if (dayOfToday >= dayOfStartDate) {
        monthsPassed +=1;
      }
      // Clamp monthsPassed
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
      remainingAmount: Math.max(0, remainingAmount),
      totalLoanAmount,
      isUpcoming
    };
  };


  const renderLoanList = () => {
    if (isLoading) {
      return <div className="flex items-center justify-center h-64 col-span-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Carregando empréstimos...</p></div>;
    }
    if (error) {
      return <div className="flex flex-col items-center justify-center h-64 text-destructive col-span-full"><AlertTriangleIcon className="h-12 w-12 mb-3" /><p className="text-lg font-semibold">{error}</p></div>;
    }
    if (loans.length === 0) {
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

      let statusColor = "bg-yellow-500";
      if (status === "Concluído") statusColor = "bg-green-500";
      else if (status === "A iniciar") statusColor = "bg-blue-500";

      return (
        <Card key={loan.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center text-xl"><Landmark className="mr-2 h-6 w-6 text-primary" />{loan.bankName}</CardTitle>
                <CardDescription>{loan.description}</CardDescription>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90" onClick={() => handleDeleteLoan(loan)} disabled={isDeletingId === loan.id}>
                  {isDeletingId === loan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 flex-grow">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center"><ReceiptText className="mr-1.5 h-4 w-4 text-muted-foreground/70" />Valor da Parcela:</span>
              <span className="font-semibold">{formatCurrency(loan.installmentAmount)}</span>
            </div>
             <div className="space-y-1 pt-1">
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Progresso ({monthsPassed}/{totalInstallments} parcelas)</span>
                <Badge variant={status === "Concluído" ? "default" : (status === "A iniciar" ? "outline" : "secondary")}
                       className={cn(
                          status === "Concluído" && "bg-green-100 text-green-700 border-green-300",
                          status === "Em andamento" && "bg-yellow-100 text-yellow-700 border-yellow-300",
                          status === "A iniciar" && "bg-blue-100 text-blue-700 border-blue-300"
                       )}
                >
                  {status}
                </Badge>
              </div>
              <Progress value={progress} className="h-2" 
                indicatorClassName={cn(
                  status === "Concluído" && "bg-green-500",
                  status === "Em andamento" && "bg-yellow-500",
                  status === "A iniciar" && "bg-blue-500",
                )}
              />
            </div>
            <Separator className="my-2" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div className="text-muted-foreground flex items-center"><CircleDollarSign className="mr-1.5 h-4 w-4 text-muted-foreground/70" />Total:</div>
                <div className="font-medium text-right">{formatCurrency(totalLoanAmount)}</div>

                <div className="text-muted-foreground flex items-center"><TrendingUp className="mr-1.5 h-4 w-4 text-green-500" />Pago:</div>
                <div className="font-medium text-green-600 text-right">{formatCurrency(paidAmount)}</div>

                <div className="text-muted-foreground flex items-center"><TrendingDown className="mr-1.5 h-4 w-4 text-orange-500" />Restante:</div>
                <div className="font-medium text-orange-600 text-right">{formatCurrency(remainingAmount)}</div>
            </div>
             <Separator className="my-2" />
             <div className_name="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center">
                    <CalendarDays className="mr-1.5 h-3.5 w-3.5 text-muted-foreground/70" />
                    <span>Início: {formattedStartDate}</span>
                </div>
                <div className="flex items-center">
                    <CalendarDays className="mr-1.5 h-3.5 w-3.5 text-muted-foreground/70" />
                    <span>Fim: {formattedEndDate} ({loan.installmentsCount}ª parcela)</span>
                </div>
            </div>
          </CardContent>
           <CardFooter className="text-xs text-muted-foreground pt-3">
            <Info className="mr-1.5 h-3.5 w-3.5 text-muted-foreground/70" />
            {status !== "Concluído" && !isUpcoming && <span>{remainingMonths} parcelas restantes. </span>}
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Empréstimos</h1>
          <p className="text-muted-foreground">
            Acompanhe seus empréstimos e pagamentos.
          </p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddModal}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo Empréstimo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>{loanToEdit ? "Editar Empréstimo" : "Adicionar Novo Empréstimo"}</DialogTitle>
              <DialogDescription>
                Preencha os detalhes do seu empréstimo. A data final será calculada automaticamente.
              </DialogDescription>
            </DialogHeader>
            <LoanForm 
              onSuccess={handleLoanAddedOrUpdated} 
              setOpen={setIsModalOpen} 
              existingLoan={loanToEdit}
            />
          </DialogContent>
        </Dialog>
      </div>

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
              disabled={!!isDeletingId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
    </TooltipProvider>
  );
}

