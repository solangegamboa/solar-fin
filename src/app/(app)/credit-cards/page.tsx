
'use client';

import { useState } from "react";
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
import { PlusCircle } from "lucide-react";
import { CreditCardForm } from "@/components/credit-cards/CreditCardForm"; // Assuming this path

export default function CreditCardsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCreditCardAdded = () => {
    setIsModalOpen(false);
    // Here you would typically refresh the list of credit cards
    // For now, just closing the modal.
    // fetchUserCreditCards(); // Example: a function to re-fetch cards
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Cartões de Crédito</h1>
          <p className="text-muted-foreground">
            Gerencie seus cartões e compras parceladas.
          </p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo Cartão
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Cartão de Crédito</DialogTitle>
              <DialogDescription>
                Preencha os detalhes do seu novo cartão abaixo.
              </DialogDescription>
            </DialogHeader>
            <CreditCardForm onSuccess={handleCreditCardAdded} setOpen={setIsModalOpen} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Seus Cartões</CardTitle>
          <CardDescription>Limites, vencimentos e faturas.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Placeholder for credit card list */}
          <div className="h-[400px] flex items-center justify-center bg-muted/50 rounded-md">
            <p className="text-muted-foreground">Lista de Cartões de Crédito em breve.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
