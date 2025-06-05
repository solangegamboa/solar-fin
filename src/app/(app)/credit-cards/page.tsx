
'use client';

import { useState, useEffect, useCallback } from "react";
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
import { PlusCircle, CreditCardIcon as CreditCardLucideIcon, CalendarDays, Landmark, AlertTriangleIcon, SearchX, Loader2 } from "lucide-react";
import { CreditCardForm } from "@/components/credit-cards/CreditCardForm";
import { getCreditCardsForUser } from "@/lib/databaseService";
import type { CreditCard } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

export default function CreditCardsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchUserCreditCards = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const userCreditCards = await getCreditCardsForUser();
      setCreditCards(userCreditCards);
    } catch (e: any) {
      const errorMessage = (e && typeof e.message === 'string') ? e.message : 'An unknown error occurred.';
      console.error("Failed to fetch credit cards:", errorMessage);
      setError("Falha ao carregar cartões. Tente novamente.");
      toast({
        variant: "destructive",
        title: "Erro ao Carregar Cartões",
        description: "Não foi possível buscar seus cartões de crédito.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUserCreditCards();
  }, [fetchUserCreditCards]);

  const handleCreditCardAdded = () => {
    setIsModalOpen(false);
    fetchUserCreditCards(); 
  };

  const renderCreditCardList = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64 col-span-1 md:col-span-2 lg:col-span-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Carregando cartões...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-destructive col-span-1 md:col-span-2 lg:col-span-3">
          <AlertTriangleIcon className="h-8 w-8 mb-2" />
          <p>{error}</p>
        </div>
      );
    }

    if (creditCards.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 col-span-1 md:col-span-2 lg:col-span-3">
          <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-xl text-muted-foreground">Nenhum cartão de crédito encontrado.</p>
          <p className="text-sm text-muted-foreground">Adicione um novo cartão para começar.</p>
        </div>
      );
    }

    return creditCards.map((card) => (
      <Card key={card.id} className="shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-xl">
              <CreditCardLucideIcon className="mr-2 h-6 w-6 text-primary" />
              {card.name}
            </CardTitle>
            {/* Placeholder for a menu or edit button */}
            {/* <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button> */}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Limite do Cartão:</span>
            <span className="font-semibold text-lg">{formatCurrency(card.limit)}</span>
          </div>
          <div className="flex items-center">
            <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Dia de Vencimento:</span>
            <span className="font-medium ml-auto">{String(card.dueDateDay).padStart(2, '0')}</span>
          </div>
          <div className="flex items-center">
            <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Dia de Fechamento:</span>
            <span className="font-medium ml-auto">{String(card.closingDateDay).padStart(2, '0')}</span>
          </div>
        </CardContent>
        {/* 
        <CardFooter className="pt-4">
          <Button variant="outline" className="w-full">Ver Faturas</Button>
        </CardFooter>
        */}
      </Card>
    ));
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {renderCreditCardList()}
      </div>
    </div>
  );
}
