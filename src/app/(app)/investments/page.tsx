
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
import { PlusCircle, Edit3, Trash2, Sun, AlertTriangleIcon, SearchX, Briefcase, LineChart, Bitcoin, PiggyBank, Building, HelpCircle } from "lucide-react";
import { InvestmentForm } from "@/components/investments/InvestmentForm";
import type { Investment, InvestmentType } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const investmentTypeIconMap: Record<InvestmentType, React.ElementType> = {
  stock: LineChart,
  savings: PiggyBank,
  crypto: Bitcoin,
  other: HelpCircle,
};

const investmentTypeLabelMap: Record<InvestmentType, string> = {
  stock: 'Ações',
  savings: 'Poupança',
  crypto: 'Criptomoedas',
  other: 'Outro',
};


export default function InvestmentsPage() {
  const { user, loading: authLoading, getToken } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [investmentToEdit, setInvestmentToEdit] = useState<Investment | null>(null);

  const [investmentToDelete, setInvestmentToDelete] = useState<Investment | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const fetchInvestments = useCallback(async () => {
    if (!user) {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    setError(null);
    const token = getToken();
    if (!token) {
      setError("Sessão inválida. Faça login novamente.");
      setIsLoading(false);
      toast({ variant: "destructive", title: "Erro de Autenticação", description: "Sessão inválida." });
      return;
    }

    try {
      const response = await fetch('/api/investments', { 
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setInvestments(data.investments);
      } else {
        setError(data.message || "Falha ao carregar investimentos.");
        toast({ variant: "destructive", title: "Erro ao Carregar", description: data.message || "Falha ao carregar os investimentos da sua conta." });
      }
    } catch (e: any) {
      setError("Falha ao conectar com o servidor para carregar investimentos.");
      toast({ variant: "destructive", title: "Erro de Rede", description: "Não foi possível buscar seus investimentos." });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast, getToken]);

  useEffect(() => {
    if (!authLoading) { 
      fetchInvestments();
    }
  }, [authLoading, fetchInvestments]);

  const handleInvestmentUpserted = (upsertedInvestment: Investment) => {
    fetchInvestments(); 
    setIsModalOpen(false);
    setInvestmentToEdit(null);
  };
  
  const openAddModal = () => {
    setInvestmentToEdit(null);
    setIsModalOpen(true);
  };

  const openEditModal = (investment: Investment) => {
    setInvestmentToEdit(investment);
    setIsModalOpen(true);
  };

  const handleDeleteInvestment = (investment: Investment) => {
    setInvestmentToDelete(investment);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDeleteInvestment = async () => {
    if (!investmentToDelete || !user) return;
    setIsDeletingId(investmentToDelete.id);
    setShowDeleteConfirmDialog(false);
    const token = getToken();
    if (!token) {
      toast({ variant: "destructive", title: "Erro de Autenticação", description: "Sessão inválida." });
      setIsDeletingId(null);
      setInvestmentToDelete(null);
      return;
    }

    try {
      const response = await fetch(`/api/investments/${investmentToDelete.id}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      const result = await response.json();

      if (response.ok && result.success) {
        toast({ title: 'Investimento Excluído!', description: `O investimento "${investmentToDelete.name}" foi excluído.` });
        setInvestments(prev => prev.filter(inv => inv.id !== investmentToDelete.id));
      } else {
        toast({ variant: 'destructive', title: 'Erro ao Excluir', description: result.message || 'Não foi possível excluir o investimento.' });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Falha ao excluir o investimento.' });
    } finally {
      setIsDeletingId(null);
      setInvestmentToDelete(null);
    }
  };
  
  const renderInvestmentCards = () => {
    if (isLoading) {
      return <div className="col-span-full flex items-center justify-center h-64"><Sun className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Carregando investimentos...</p></div>;
    }
    if (error) {
      return <div className="col-span-full flex flex-col items-center justify-center h-64 text-destructive"><AlertTriangleIcon className="h-12 w-12 mb-3" /><p>{error}</p></div>;
    }
    if (investments.length === 0) {
      return <div className="col-span-full flex flex-col items-center justify-center h-64 text-muted-foreground"><SearchX className="h-12 w-12 mb-3" /><p className="text-lg">Nenhum investimento encontrado.</p><p className="text-sm">Adicione seu primeiro investimento para começar!</p></div>;
    }

    return investments.map(inv => {
      const IconComponent = investmentTypeIconMap[inv.type] || HelpCircle;
      const typeLabel = investmentTypeLabelMap[inv.type] || 'Desconhecido';
      const performance = inv.initialAmount && inv.initialAmount > 0 ? ((inv.currentValue - inv.initialAmount) / inv.initialAmount) * 100 : null;

      return (
        <Card key={inv.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <IconComponent className="mr-3 h-7 w-7 text-primary" />
                <div>
                  <CardTitle className="text-lg font-semibold">{inv.name}</CardTitle>
                  <Badge variant="secondary" className="mt-1 text-xs">{typeLabel}</Badge>
                </div>
              </div>
              <div className="flex gap-1">
                 <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditModal(inv)} disabled={isDeletingId === inv.id || !user}>
                    <Edit3 className="h-4 w-4" />
                 </Button>
                 <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive/90" onClick={() => handleDeleteInvestment(inv)} disabled={isDeletingId === inv.id || !user}>
                    {isDeletingId === inv.id ? <Sun className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                 </Button>
              </div>
            </div>
             {inv.symbol && <CardDescription className="text-xs pt-1">Símbolo: {inv.symbol}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-2 flex-grow text-sm">
            <div className="flex justify-between items-baseline">
                <span className="text-sm text-muted-foreground">Valor Atual:</span>
                <span className="text-lg font-bold text-primary">{formatCurrency(inv.currentValue)}</span>
            </div>
            {inv.initialAmount != null && (
                 <div className="flex justify-between items-baseline text-xs">
                    <span className="text-muted-foreground">Valor Inicial:</span>
                    <span>{formatCurrency(inv.initialAmount)}</span>
                </div>
            )}
            {performance != null && (
                <div className="flex justify-between items-baseline text-xs">
                    <span className="text-muted-foreground">Performance:</span>
                    <span className={cn(performance >= 0 ? "text-green-600" : "text-red-600", "font-semibold")}>
                        {performance >= 0 ? '+' : ''}{performance.toFixed(2)}%
                    </span>
                </div>
            )}
             {inv.quantity != null && (
                 <div className="flex justify-between items-baseline text-xs">
                    <span className="text-muted-foreground">Quantidade:</span>
                    <span>{inv.quantity.toLocaleString('pt-BR', { maximumFractionDigits: inv.type === 'crypto' ? 8 : 2 })}</span>
                </div>
            )}
            {inv.institution && (
                <div className="text-xs text-muted-foreground flex items-center pt-1">
                    <Building className="mr-1.5 h-3.5 w-3.5" /> {inv.institution}
                </div>
            )}
            {inv.acquisitionDate && (
              <div className="text-xs text-muted-foreground">
                Adquirido em: {format(parseISO(inv.acquisitionDate), 'dd/MM/yyyy', { locale: ptBR })}
              </div>
            )}
            {inv.notes && (
                 <p className="text-xs text-muted-foreground pt-1 border-t mt-2 italic">"{inv.notes}"</p>
            )}
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground pt-2 pb-3">
             Última atualização: {format(new Date(inv.updatedAt), 'dd/MM/yy HH:mm', { locale: ptBR })}
          </CardFooter>
        </Card>
      );
    });
  };

  if (authLoading) {
    return <div className="flex items-center justify-center h-64"><Sun className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Carregando...</p></div>;
  }
  if (!user && !authLoading) { 
     return <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><AlertTriangleIcon className="h-12 w-12 mb-3" /><p className="text-lg">Por favor, faça login para acessar esta página.</p></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center">
            <Briefcase className="mr-3 h-8 w-8 text-primary" />
            Meus Investimentos
          </h1>
          <p className="text-muted-foreground">
            Acompanhe seus ativos e seu patrimônio.
          </p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={(isOpen) => { setIsModalOpen(isOpen); if (!isOpen) setInvestmentToEdit(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openAddModal} className="w-full sm:w-auto" disabled={!user}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo Investimento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{investmentToEdit ? "Editar Investimento" : "Adicionar Novo Investimento"}</DialogTitle>
              <DialogDescription>
                {investmentToEdit ? "Atualize os detalhes do seu investimento." : "Preencha os detalhes do seu novo investimento."}
              </DialogDescription>
            </DialogHeader>
            {user && <InvestmentForm userId={user.id} existingInvestment={investmentToEdit} onSuccess={handleInvestmentUpserted} setOpen={setIsModalOpen} />}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {renderInvestmentCards()}
      </div>

      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o investimento "{investmentToDelete?.name || 'selecionado'}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setInvestmentToDelete(null)} disabled={!!isDeletingId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteInvestment}
              disabled={!!isDeletingId || !user}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingId ? <Sun className="mr-2 h-4 w-4 animate-spin" /> : null}
              Excluir Investimento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
