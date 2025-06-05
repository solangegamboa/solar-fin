
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PlusCircle, ArrowUpCircle, ArrowDownCircle, Sun, AlertTriangleIcon, SearchX, Copy, RefreshCw, Trash2 } from "lucide-react";
import type { Transaction, NewTransactionData } from '@/types';
import { getTransactionsForUser, addTransaction, deleteTransaction } from '@/lib/databaseService';
import { formatCurrency, cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export default function TransactionsPage() {
  const { user, loading: authLoading } = useAuth();
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
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const userTransactions = await getTransactionsForUser(user.id);
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
  }, [toast, user]);

  useEffect(() => {
    if (user && !authLoading) {
      fetchUserTransactions();
    }
  }, [fetchUserTransactions, user, authLoading]);

  const handleTransactionAdded = () => {
    fetchUserTransactions(); 
  };

  const handleDuplicateTransaction = async (transaction: Transaction) => {
    if (!user) return;
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

      const result = await addTransaction(user.id, newTransactionData);

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
    if (!transactionToDelete || !user) return;
    setIsDeletingId(transactionToDelete.id);
    setShowDeleteConfirmDialog(false);

    try {
      const result = await deleteTransaction(user.id, transactionToDelete.id);
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

  if (authLoading || isLoading && !transactions.length ) {
    return <div className="flex items-center justify-center h-64"><Sun className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Carregando...</p></div>;
  }

  const renderMobileTransactionCards = () => (
    <div className="space-y-4 md:hidden">
      {transactions.map((transaction) => (
        <Card key={transaction.id} className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-base font-semibold">{transaction.description || 'Sem descrição'}</CardTitle>
                <CardDescription className="text-xs">{format(parseISO(transaction.date), 'dd/MM/yyyy', { locale: ptBR })}</CardDescription>
              </div>
              <Badge 
                variant={transaction.type === 'income' ? 'default' : 'destructive'} 
                className={cn(
                  "text-xs",
                  transaction.type === 'income' ? 'bg-positive/20 text-positive-foreground border-positive/30' : 'bg-negative/20 text-negative-foreground border-negative/30'
                )}
              >
                {transaction.type === 'income' ? <ArrowUpCircle className="mr-1 h-3 w-3"/> : <ArrowDownCircle className="mr-1 h-3 w-3"/>}
                {transaction.type === 'income' ? 'Receita' : 'Despesa'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 pb-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Valor:</span>
              <span className={`font-medium ${transaction.type === 'income' ? 'text-positive' : 'text-negative'}`}>
                {formatCurrency(transaction.amount)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Categoria:</span>
              <Badge variant={transaction.isRecurring ? "default" : "secondary"} className={cn("text-xs", transaction.isRecurring ? "bg-blue-100 text-blue-700 border-blue-300" : "")}>
                {transaction.category}
                {transaction.isRecurring && <RefreshCw className="ml-1.5 h-3 w-3" />}
              </Badge>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end space-x-1 pt-2 pb-3">
            {transaction.isRecurring && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDuplicateTransaction(transaction)}
                disabled={isDuplicatingId === transaction.id || !!isDeletingId || !user}
                aria-label="Duplicar transação"
                className="h-7 w-7"
              >
                {isDuplicatingId === transaction.id ? (
                  <Sun className="h-3 w-3 animate-spin" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            )}
            <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteTransaction(transaction)}
                disabled={isDeletingId === transaction.id || !!isDuplicatingId || !user}
                aria-label="Excluir transação"
                className="h-7 w-7 text-destructive hover:text-destructive/80"
              >
                {isDeletingId === transaction.id ? (
                  <Sun className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
  

  const renderTransactionTableRows = () => {
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
              disabled={isDuplicatingId === transaction.id || !!isDeletingId || !user}
              aria-label="Duplicar transação"
              className="h-8 w-8"
            >
              {isDuplicatingId === transaction.id ? (
                <Sun className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
           <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteTransaction(transaction)}
              disabled={isDeletingId === transaction.id || !!isDuplicatingId || !user}
              aria-label="Excluir transação"
              className="h-8 w-8 text-destructive hover:text-destructive/80"
            >
              {isDeletingId === transaction.id ? (
                <Sun className="h-4 w-4 animate-spin" />
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
            <Button className="w-full sm:w-auto" disabled={!user}>
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
            {user && <TransactionForm onSuccess={handleTransactionAdded} setOpen={setIsModalOpen} userId={user.id} />}
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Histórico de Transações</CardTitle>
          <CardDescription>Veja todas as suas movimentações financeiras.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && transactions.length === 0 ? ( 
            <div className="h-[300px] flex items-center justify-center">
              <Sun className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Carregando transações...</p>
            </div>
          ) : error ? (
            <div className="h-[300px] flex flex-col items-center justify-center text-destructive">
              <AlertTriangleIcon className="h-8 w-8 mb-2" />
              <p>{error}</p>
            </div>
          ) : transactions.length === 0 ? (
             <div className="h-[200px] md:h-[300px] flex flex-col items-center justify-center space-y-2 text-center">
                <SearchX className="h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhuma transação encontrada.</p>
                <p className="text-xs text-muted-foreground">Adicione uma nova transação para começar.</p>
            </div>
          ) : (
            <>
              {renderMobileTransactionCards()}
              <div className="hidden md:block overflow-x-auto">
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
                    {renderTransactionTableRows()}
                  </TableBody>
                </Table>
              </div>
            </>
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
  );
}

    