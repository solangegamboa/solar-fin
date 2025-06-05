
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
import { PlusCircle, Landmark, CalendarDays, Trash2, Loader2, AlertTriangleIcon, SearchX, Edit3 } from "lucide-react";
import { LoanForm } from "@/components/loans/LoanForm";
import type { Loan } from "@/types";
import { getLoansForUser, deleteLoan } from "@/lib/databaseService";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { format, parseISO, isPast, isFuture, differenceInMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function LoansPage() {
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

  const openEditModal = (loan: Loan) => {
    setLoanToEdit(loan);
    setIsModalOpen(true);
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
  
  const calculateLoanProgress = (loan: Loan): { progress: number; status: string; remainingMonths: number; totalMonths: number } => {
    const startDate = parseISO(loan.startDate);
    const endDate = parseISO(loan.endDate);
    const today = new Date();

    if (isPast(endDate)) {
      return { progress: 100, status: "Concluído", remainingMonths: 0, totalMonths: differenceInMonths(endDate, startDate) +1  };
    }
    if (isFuture(startDate)) {
      return { progress: 0, status: "A iniciar", remainingMonths: differenceInMonths(endDate, startDate) + 1, totalMonths: differenceInMonths(endDate, startDate) + 1 };
    }

    const totalMonths = differenceInMonths(endDate, startDate) + 1;
    const monthsPassed = differenceInMonths(today, startDate) +1;
    const progress = Math.min(100, Math.max(0,(monthsPassed / totalMonths) * 100));
    const remainingMonths = differenceInMonths(endDate, today) +1;
    
    return { progress, status: "Em andamento", remainingMonths: Math.max(0, remainingMonths), totalMonths };
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
      const { progress, status, remainingMonths, totalMonths } = calculateLoanProgress(loan);
      const formattedStartDate = format(parseISO(loan.startDate), 'dd/MM/yyyy', { locale: ptBR });
      const formattedEndDate = format(parseISO(loan.endDate), 'dd/MM/yyyy', { locale: ptBR });

      return (
        <Card key={loan.id} className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-xl"><Landmark className="mr-2 h-6 w-6 text-primary" />{loan.bankName}</CardTitle>
              <div className="flex gap-1">
                {/* <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditModal(loan)} disabled={!!isDeletingId}> <Edit3 className="h-4 w-4" /> </Button> */}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90" onClick={() => handleDeleteLoan(loan)} disabled={isDeletingId === loan.id}>
                  {isDeletingId === loan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <CardDescription>{loan.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Valor da Parcela:</span>
              <span className="font-semibold">{formatCurrency(loan.installmentAmount)}</span>
            </div>
            <div className="flex items-center">
              <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Início: {formattedStartDate}</span>
            </div>
            <div className="flex items-center">
              <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Fim: {formattedEndDate}</span>
            </div>
             <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progresso ({totalMonths - remainingMonths}/{totalMonths} meses)</span>
                <Badge variant={status === "Concluído" ? "default" : (status === "A iniciar" ? "outline" : "secondary")}>{status}</Badge>
              </div>
              <Progress value={progress} className="h-2" />
              {status !== "Concluído" && <p className="text-xs text-muted-foreground text-right">{remainingMonths} parcelas restantes</p>}
            </div>
          </CardContent>
        </Card>
      );
    });
  };


  return (
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
                Preencha os detalhes do seu empréstimo.
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
  );
}
