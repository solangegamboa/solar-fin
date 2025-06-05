
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
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { PlusCircle, ArrowUpCircle, ArrowDownCircle, Loader2, AlertTriangleIcon, SearchX } from "lucide-react";
import type { Transaction } from '@/types';
import { getTransactionsForUser } from '@/lib/databaseService';
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
    fetchUserTransactions(); // Refresh list after adding a new transaction
  };

  const renderTransactionRows = () => {
    if (transactions.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="h-24 text-center">
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
        <TableCell className="font-medium max-w-[200px] truncate" title={transaction.description}>
          {transaction.description || '-'}
        </TableCell>
        <TableCell>
          <Badge variant="secondary">{transaction.category}</Badge>
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
      </TableRow>
    ));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Transações</h1>
          <p className="text-muted-foreground">
            Gerencie suas receitas e despesas.
          </p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Nova Transação
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderTransactionRows()}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
