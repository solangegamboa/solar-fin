
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
import { PlusCircle, Edit3, Trash2, Sun, AlertTriangleIcon, SearchX, Target as TargetIcon, PiggyBank, TrendingUp, Flag, CheckCircle2, XCircle, CalendarClock } from "lucide-react";
import { FinancialGoalForm } from "@/components/goals/FinancialGoalForm";
import type { FinancialGoal } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn } from "@/lib/utils";
import { format, parseISO, differenceInDays, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from '@/components/ui/badge';

const iconMap: { [key: string]: React.ElementType } = {
  PiggyBank,
  Target: TargetIcon,
  TrendingUp,
  Flag,
  Award: Flag, 
  Briefcase: Flag,
  Car: Flag,
  Home: Flag,
  Gift: Flag,
  GraduationCap: Flag,
  Default: TargetIcon,
};

export default function FinancialGoalsPage() {
  const { user, loading: authLoading } = useAuth();
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [goalToEdit, setGoalToEdit] = useState<FinancialGoal | null>(null);

  const [goalToDelete, setGoalToDelete] = useState<FinancialGoal | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/goals');
      const data = await response.json();
      if (response.ok && data.success) {
        setGoals(data.goals);
      } else {
        setError(data.message || "Falha ao carregar metas.");
        toast({ variant: "destructive", title: "Erro", description: data.message || "Falha ao carregar metas." });
      }
    } catch (e: any) {
      setError("Falha ao conectar com o servidor para carregar metas.");
      toast({ variant: "destructive", title: "Erro de Rede", description: "Não foi possível buscar suas metas." });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user && !authLoading) {
      fetchGoals();
    }
  }, [user, authLoading, fetchGoals]);

  const handleGoalUpserted = (updatedGoal: FinancialGoal) => {
    // This function is called by FinancialGoalForm on success.
    // It will either add a new goal or update an existing one in the local state.
    // For simplicity, we refetch all goals. A more optimized solution could update local state.
    fetchGoals();
    setIsModalOpen(false);
    setGoalToEdit(null);
  };
  
  const openAddModal = () => {
    setGoalToEdit(null);
    setIsModalOpen(true);
  };

  const openEditModal = (goal: FinancialGoal) => {
    setGoalToEdit(goal);
    setIsModalOpen(true);
  };

  const handleDeleteGoal = (goal: FinancialGoal) => {
    setGoalToDelete(goal);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDeleteGoal = async () => {
    if (!goalToDelete || !user) return;
    setIsDeletingId(goalToDelete.id);
    setShowDeleteConfirmDialog(false);

    try {
      const response = await fetch(`/api/goals/${goalToDelete.id}`, { method: 'DELETE' });
      const result = await response.json();

      if (response.ok && result.success) {
        toast({ title: 'Meta Excluída!', description: `A meta "${goalToDelete.name}" foi excluída.` });
        setGoals(prevGoals => prevGoals.filter(g => g.id !== goalToDelete.id));
      } else {
        toast({ variant: 'destructive', title: 'Erro ao Excluir', description: result.message || 'Não foi possível excluir a meta.' });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Falha ao excluir a meta.' });
    } finally {
      setIsDeletingId(null);
      setGoalToDelete(null);
    }
  };
  
  const getDaysRemaining = (targetDateStr?: string | null): string | null => {
    if (!targetDateStr) return null;
    const targetDate = parseISO(targetDateStr);
    if (!isValid(targetDate)) return null;
    const today = new Date();
    today.setHours(0,0,0,0); // Normalize today to start of day for fair comparison
    if (targetDate < today) return "Prazo Expirado";
    const days = differenceInDays(targetDate, today);
    if (days === 0) return "Hoje!";
    return `${days} dia${days > 1 ? 's' : ''} restante${days > 1 ? 's' : ''}`;
  };


  const renderGoalCards = () => {
    if (isLoading) {
      return <div className="col-span-full flex items-center justify-center h-64"><Sun className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Carregando metas...</p></div>;
    }
    if (error) {
      return <div className="col-span-full flex flex-col items-center justify-center h-64 text-destructive"><AlertTriangleIcon className="h-12 w-12 mb-3" /><p>{error}</p></div>;
    }
    if (goals.length === 0) {
      return <div className="col-span-full flex flex-col items-center justify-center h-64 text-muted-foreground"><SearchX className="h-12 w-12 mb-3" /><p className="text-lg">Nenhuma meta financeira encontrada.</p><p className="text-sm">Crie sua primeira meta para começar!</p></div>;
    }

    return goals.map(goal => {
      const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
      const IconComponent = iconMap[goal.icon || 'Default'] || TargetIcon;
      const daysRemaining = getDaysRemaining(goal.targetDate);
      
      let statusBadgeVariant: "default" | "secondary" | "destructive" | "outline" = "secondary";
      let statusText = "Ativa";
      let statusIcon = <TargetIcon className="mr-1.5 h-3 w-3" />;

      if (goal.status === 'achieved') {
        statusBadgeVariant = "default"; // Typically green for success
        statusText = "Alcançada";
        statusIcon = <CheckCircle2 className="mr-1.5 h-3 w-3" />;
      } else if (goal.status === 'abandoned') {
        statusBadgeVariant = "destructive";
        statusText = "Abandonada";
        statusIcon = <XCircle className="mr-1.5 h-3 w-3" />;
      }

      return (
        <Card key={goal.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <IconComponent className="mr-3 h-7 w-7 text-primary" />
                <div>
                  <CardTitle className="text-lg font-semibold">{goal.name}</CardTitle>
                  {goal.description && <CardDescription className="text-xs leading-tight mt-0.5">{goal.description}</CardDescription>}
                </div>
              </div>
              <div className="flex gap-1">
                 <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditModal(goal)} disabled={isDeletingId === goal.id || !user}>
                    <Edit3 className="h-4 w-4" />
                 </Button>
                 <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive/90" onClick={() => handleDeleteGoal(goal)} disabled={isDeletingId === goal.id || !user}>
                    {isDeletingId === goal.id ? <Sun className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                 </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 flex-grow text-sm">
            <div className="space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-muted-foreground">Progresso ({formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)})</span>
                <span className="text-xs font-medium">{Math.min(100, progress).toFixed(0)}%</span>
              </div>
              <Progress value={progress} className="h-2" indicatorClassName={cn(goal.status === 'achieved' ? 'bg-green-500' : goal.status === 'abandoned' ? 'bg-destructive' : 'bg-primary')} />
            </div>
            {goal.targetDate && (
              <div className="text-xs text-muted-foreground flex items-center">
                <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                Data Alvo: {format(parseISO(goal.targetDate), 'dd/MM/yyyy', { locale: ptBR })}
                {daysRemaining && <span className={cn("ml-1.5 font-medium", daysRemaining === "Prazo Expirado" && goal.status !== 'achieved' ? "text-destructive" : "")}>({daysRemaining})</span>}
              </div>
            )}
             <Badge variant={statusBadgeVariant} className={cn(
                "text-xs",
                goal.status === 'achieved' && "bg-green-100 text-green-700 border-green-300 dark:bg-green-800/30 dark:text-green-300 dark:border-green-700",
                goal.status === 'active' && "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-800/30 dark:text-blue-300 dark:border-blue-700",
                goal.status === 'abandoned' && "bg-red-100 text-red-700 border-red-300 dark:bg-red-800/30 dark:text-red-300 dark:border-red-700"
                )}>
                {statusIcon}
                {statusText}
            </Badge>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground pt-2 pb-3">
             Criada em: {format(new Date(goal.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
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
            <TargetIcon className="mr-3 h-8 w-8 text-primary" />
            Minhas Metas Financeiras
          </h1>
          <p className="text-muted-foreground">
            Defina e acompanhe seus objetivos de economia.
          </p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={(isOpen) => { setIsModalOpen(isOpen); if (!isOpen) setGoalToEdit(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openAddModal} className="w-full sm:w-auto" disabled={!user}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Nova Meta
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{goalToEdit ? "Editar Meta Financeira" : "Criar Nova Meta Financeira"}</DialogTitle>
              <DialogDescription>
                {goalToEdit ? "Atualize os detalhes da sua meta." : "Preencha os detalhes da sua nova meta."}
              </DialogDescription>
            </DialogHeader>
            {user && <FinancialGoalForm userId={user.id} existingGoal={goalToEdit} onSuccess={handleGoalUpserted} setOpen={setIsModalOpen} />}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {renderGoalCards()}
      </div>

      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a meta "{goalToDelete?.name || 'selecionada'}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setGoalToDelete(null)} disabled={!!isDeletingId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteGoal}
              disabled={!!isDeletingId || !user}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingId ? <Sun className="mr-2 h-4 w-4 animate-spin" /> : null}
              Excluir Meta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
