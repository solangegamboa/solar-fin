
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { PlusCircle, ArrowUpCircle, ArrowDownCircle, Loader2, AlertTriangleIcon, SearchX, Copy, RefreshCw, Trash2 } from "lucide-react";
import type { Transaction, NewTransactionData } from '@/types';
import { getTransactionsForUser, addTransaction, deleteTransaction } from '@/lib/databaseService';
import { formatCurrency } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function TransactionsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDuplicatingId, setIsDuplicatingId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const { toast } = useToast();

  const fetchUserTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const userTransactions = await getTransactionsForUser();
      setTransactions(userTransactions);
    } catch (e: any) {
      const errorMessage = (e && typeof e.message === 'string') ? e.message : 'An unknown error occurred.';
      console.error("Failed to fetch transactions:", errorMessage);
      setError("Falha ao carregar transações. Tente novamente.");
      toast({
        variant: "destructive",
        title: "Erro ao Carregar Transações",
        description: "Não foi possível buscar suas transações.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUserTransactions();
  }, [fetchUserTransactions]);

  const handleTransactionAdded = () => {
    fetchUserTransactions(); 
  };

  const handleDuplicateTransaction = async (transaction: Transaction) => {
    setIsDuplicatingId(transaction.id);
    try {
      const newTransactionData: NewTransactionData = {
        type: transaction.type,
        amount: transaction.amount,
        category: transaction.category,
        description: transaction.description || '',
        date: format(new Date(), 'yyyy-MM-dd'), 
        isRecurring: transaction.isRecurring,
      };

      const result = await addTransaction(newTransactionData);

      if (result.success) {
        toast({
          title: 'Transação Duplicada!',
          description: 'A transação recorrente foi duplicada para a data atual.',
        });
        fetchUserTransactions(); 
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao Duplicar',
          description: result.error || 'Não foi possível duplicar a transação.',
        });
      }
    } catch (e: any) {
      const errorMessage = (e && typeof e.message === 'string') ? e.message : 'Ocorreu um erro desconhecido.';
      console.error('Error duplicating transaction:', errorMessage);
      toast({
        variant: 'destructive',
        title: 'Erro ao Duplicar',
        description: 'Ocorreu um erro ao tentar duplicar a transação.',
      });
    } finally {
      setIsDuplicatingId(null);
    }
  };

  const handleDeleteTransaction = (transaction: Transaction) => {
    setTransactionToDelete(transaction);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDeleteTransaction = async () => {
    if (!transactionToDelete) return;
    setIsDeletingId(transactionToDelete.id);
    setShowDeleteConfirmDialog(false);

    try {
      const result = await deleteTransaction(transactionToDelete.id);
      if (result.success) {
        toast({
          title: 'Transação Excluída!',
          description: 'A transação foi excluída com sucesso.',
        });
        fetchUserTransactions();
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao Excluir',
          description: result.error || 'Não foi possível excluir a transação.',
        });
      }
    } catch (e: any) {
      const errorMessage = (e && typeof e.message === 'string') ? e.message : 'Ocorreu um erro desconhecido.';
      console.error('Error deleting transaction:', errorMessage);
      toast({
        variant: 'destructive',
        title: 'Erro ao Excluir',
        description: 'Ocorreu um erro ao tentar excluir a transação.',
      });
    } finally {
      setIsDeletingId(null);
      setTransactionToDelete(null);
    }
  };


  const renderTransactionRows = () => {
    if (transactions.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="h-24 text-center">
            <div className="flex flex-col items-center justify-center space-y-2">
              <SearchX className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhuma transação encontrada.</p>
              <p className="text-xs text-muted-foreground">Adicione uma nova transação para começar.</p>
            </div>
          </TableCell>
        </TableRow>
      );
    }

    return transactions.map((transaction) => (
      <TableRow key={transaction.id}>
        <TableCell>
          {format(parseISO(transaction.date), 'dd/MM/yyyy', { locale: ptBR })}
        </TableCell>
        <TableCell className="font-medium max-w-[120px] sm:max-w-[200px] truncate" title={transaction.description}>
          {transaction.description || '-'}
        </TableCell>
        <TableCell>
          <Badge variant={transaction.isRecurring ? "default" : "secondary"} className={transaction.isRecurring ? "bg-blue-500 hover:bg-blue-600 text-white" : ""}>
            {transaction.category}
            {transaction.isRecurring && <RefreshCw className="ml-1.5 h-3 w-3" />}
          </Badge>
        </TableCell>
        <TableCell className={`flex items-center ${transaction.type === 'income' ? 'text-positive' : 'text-negative'}`}>
          {transaction.type === 'income' ? (
            <ArrowUpCircle className="mr-2 h-4 w-4" />
          ) : (
            <ArrowDownCircle className="mr-2 h-4 w-4" />
          )}
          {transaction.type === 'income' ? 'Receita' : 'Despesa'}
        </TableCell>
        <TableCell className={`text-right font-semibold ${transaction.type === 'income' ? 'text-positive' : 'text-negative'}`}>
          {formatCurrency(transaction.amount)}
        </TableCell>
        <TableCell className="text-right space-x-1">
          {transaction.isRecurring && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDuplicateTransaction(transaction)}
              disabled={isDuplicatingId === transaction.id || !!isDeletingId}
              aria-label="Duplicar transação"
              className="h-8 w-8"
            >
              {isDuplicatingId === transaction.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
           <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteTransaction(transaction)}
              disabled={isDeletingId === transaction.id || !!isDuplicatingId}
              aria-label="Excluir transação"
              className="h-8 w-8 text-destructive hover:text-destructive/80"
            >
              {isDeletingId === transaction.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Transações</h1>
          <p className="text-muted-foreground">
            Gerencie suas receitas e despesas.
          </p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nova Transação
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Adicionar Nova Transação</DialogTitle>
              <DialogDescription>
                Preencha os detalhes da sua transação abaixo.
              </DialogDescription>
            </DialogHeader>
            <TransactionForm onSuccess={handleTransactionAdded} setOpen={setIsModalOpen} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Histórico de Transações</CardTitle>
          <CardDescription>Veja todas as suas movimentações financeiras.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Carregando transações...</p>
            </div>
          ) : error ? (
            <div className="h-[300px] flex flex-col items-center justify-center text-destructive">
              <AlertTriangleIcon className="h-8 w-8 mb-2" />
              <p>{error}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderTransactionRows()}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a transação "{transactionToDelete?.description || 'selecionada'}" no valor de {formatCurrency(transactionToDelete?.amount || 0)}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTransactionToDelete(null)} disabled={!!isDeletingId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTransaction}
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

    

    