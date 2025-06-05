
'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { PlusCircle } from "lucide-react";

export default function TransactionsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleTransactionAdded = () => {
    // TODO: Logic to refresh transaction list if displayed on this page
    console.log("Transaction added, potentially refresh list here.");
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
          {/* Placeholder for transaction list/table */}
          <div className="h-[400px] flex items-center justify-center bg-muted/50 rounded-md">
            <p className="text-muted-foreground">Lista de Transações em breve.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
