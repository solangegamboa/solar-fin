
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Sun, Upload, AlertTriangle, FileImage, Trash2, ScanLine } from 'lucide-react';
import { extractStatementTransactionsFromImage } from '@/ai/flows/extract-statement-transactions-flow';
import type { ExtractStatementTransactionsOutput, ExtractedTransaction, UserCategory, NewTransactionData, TransactionType } from '@/types';
import { addTransaction, getCategoriesForUser, addCategoryForUser } from '@/lib/databaseService';
import { format, parseISO, isValid as isValidDate } from 'date-fns';
import { Card } from '@/components/ui/card';

interface EditableExtractedTransaction extends ExtractedTransaction {
  id: string; // For unique key in UI
  isSelected: boolean;
  userSelectedType: TransactionType | 'unknown';
  userSelectedDate: Date | null;
  userSelectedCategory: string;
  userDescription: string;
  userAmount: number | null; // Should now always store the absolute value
}

interface ImportStatementDialogProps {
  userId: string;
  setOpen: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ImportStatementDialog({ userId, setOpen, onSuccess }: ImportStatementDialogProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractStatementTransactionsOutput | null>(null);
  const [editableTransactions, setEditableTransactions] = useState<EditableExtractedTransaction[]>([]);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(new Date());
  const [userCategories, setUserCategories] = useState<UserCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [extractionAttemptId, setExtractionAttemptId] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchUserCategories = useCallback(async () => {
    if (!userId) return;
    setIsLoadingCategories(true);
    try {
      const categories = await getCategoriesForUser(userId);
      setUserCategories(categories);
    } catch (error) {
      console.error('Failed to fetch user categories:', error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar suas categorias." });
    } finally {
      setIsLoadingCategories(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchUserCategories();
  }, [fetchUserCategories]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      setExtractionResult(null);
      setEditableTransactions([]);
    }
  };

  const handleClearImage = () => {
    setImageFile(null);
    setImagePreviewUrl(null);
    setExtractionResult(null);
    setEditableTransactions([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExtractTransactions = async () => {
    if (!imageFile || !imagePreviewUrl) {
      toast({ variant: 'destructive', title: 'Nenhuma Imagem', description: 'Por favor, carregue uma imagem do extrato.' });
      return;
    }
    setExtractionAttemptId(prev => prev + 1); // Increment attempt ID to refresh key
    setIsProcessingImage(true);
    setExtractionResult(null);
    setEditableTransactions([]);

    try {
      const result = await extractStatementTransactionsFromImage({
        imageDataUri: imagePreviewUrl,
        defaultYear: defaultDate ? defaultDate.getFullYear() : new Date().getFullYear(),
      });
      setExtractionResult(result);
      if (result.transactions && result.transactions.length > 0) {
        setEditableTransactions(
          result.transactions.map((tx, index) => {
            let parsedDate: Date | null = null;
            if (tx.date) {
                try {
                    parsedDate = parseISO(tx.date);
                    if (!isValidDate(parsedDate)) parsedDate = null;
                } catch (e) { parsedDate = null; }
            }
            
            let typeSuggestionBasedOnAmount: TransactionType | 'unknown' = 'unknown';
            let finalUserAmount: number | null = null;

            if (tx.amount !== null && tx.amount !== undefined) {
                finalUserAmount = Math.abs(tx.amount);
                if (tx.amount < 0) {
                    typeSuggestionBasedOnAmount = 'expense';
                } else if (tx.amount > 0) {
                    typeSuggestionBasedOnAmount = 'income';
                }
            }

            return {
              ...tx,
              id: `extracted-${index}-${Date.now()}`,
              isSelected: true, 
              userSelectedType: tx.typeSuggestion && tx.typeSuggestion !== 'unknown' ? tx.typeSuggestion : typeSuggestionBasedOnAmount,
              userSelectedDate: parsedDate || defaultDate || new Date(),
              userSelectedCategory: '', 
              userDescription: tx.description || tx.rawText || '',
              userAmount: finalUserAmount,
            };
          })
        );
        toast({ title: 'Extração Concluída', description: `${result.transactions.length} transações potenciais encontradas. Revise e confirme.` });
      } else {
        toast({ title: 'Extração Concluída', description: 'Nenhuma transação encontrada ou identificada na imagem.' });
      }
    } catch (error: any) {
      console.error('Error extracting transactions from image:', error);
      toast({ variant: 'destructive', title: 'Erro na Extração', description: error.message || 'Não foi possível processar a imagem.' });
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleTransactionFieldChange = (id: string, field: keyof EditableExtractedTransaction, value: any) => {
    setEditableTransactions(prev =>
      prev.map(tx => (tx.id === id ? { ...tx, [field]: value } : tx))
    );
  };

  const handleAddNewCategory = async (categoryName: string): Promise<UserCategory | null> => {
    if (!userId) {
      toast({ variant: "destructive", title: "Erro", description: "Usuário não identificado." });
      return null;
    }
    setIsSaving(true); 
    const result = await addCategoryForUser(userId, categoryName);
    setIsSaving(false);
    if (result.success && result.category) {
      setUserCategories(prev => [...prev, result.category!].sort((a,b) => a.name.localeCompare(b.name)));
      return result.category;
    } else {
      toast({ variant: "destructive", title: "Erro ao Adicionar Categoria", description: result.error || "Não foi possível salvar a nova categoria." });
      return null;
    }
  };

  const handleSaveSelectedTransactions = async () => {
    const transactionsToSave = editableTransactions.filter(tx => tx.isSelected);
    if (transactionsToSave.length === 0) {
      toast({ title: 'Nenhuma Transação Selecionada', description: 'Marque as transações que deseja importar.' });
      return;
    }

    let allValid = true;
    for (const tx of transactionsToSave) {
      if (!tx.userAmount || tx.userAmount <= 0) { 
        toast({ variant: 'destructive', title: 'Valor Inválido', description: `Transação "${tx.userDescription}" tem valor inválido. Deve ser positivo.` });
        allValid = false; break;
      }
      if (!tx.userSelectedDate) {
        toast({ variant: 'destructive', title: 'Data Inválida', description: `Transação "${tx.userDescription}" não tem data.` });
        allValid = false; break;
      }
      if (tx.userSelectedType === 'unknown') {
        toast({ variant: 'destructive', title: 'Tipo Inválido', description: `Selecione o tipo para "${tx.userDescription}".` });
        allValid = false; break;
      }
      if (!tx.userSelectedCategory) {
        toast({ variant: 'destructive', title: 'Categoria Inválida', description: `Selecione a categoria para "${tx.userDescription}".` });
        allValid = false; break;
      }
    }

    if (!allValid) return;

    setIsSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const tx of transactionsToSave) {
      const newTxData: NewTransactionData = {
        amount: tx.userAmount!, 
        date: format(tx.userSelectedDate!, 'yyyy-MM-dd'),
        type: tx.userSelectedType as TransactionType, 
        category: tx.userSelectedCategory,
        description: tx.userDescription,
        recurrenceFrequency: 'none', 
      };
      try {
        const result = await addTransaction(userId, newTxData);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          console.error(`Failed to save transaction "${tx.userDescription}": ${result.error}`);
        }
      } catch (e) {
        errorCount++;
        console.error(`Exception saving transaction "${tx.userDescription}":`, e);
      }
    }
    setIsSaving(false);

    if (successCount > 0) {
      toast({ title: 'Importação Concluída', description: `${successCount} transações salvas com sucesso.` });
      if (onSuccess) onSuccess();
    }
    if (errorCount > 0) {
      toast({ variant: 'destructive', title: 'Erros na Importação', description: `${errorCount} transações não puderam ser salvas. Verifique o console para detalhes.` });
    }
    if (successCount > 0 && errorCount === 0) {
      setOpen(false); 
    } else if (successCount === 0 && errorCount > 0) {
       
    } else if (successCount > 0 && errorCount > 0) {
      
      setEditableTransactions(prev => prev.filter(tx => !tx.isSelected || transactionsToSave.find(saved => saved.id === tx.id && errorCount > 0 )));
    }

  };


  return (
    <div className="flex flex-col h-full w-full">
      <DialogHeader>
        <DialogTitle>Importar Transações de Extrato Bancário</DialogTitle>
        <DialogDescription>
            Envie uma imagem (printscreen) do seu extrato. A IA tentará identificar as transações.
            Revise e ajuste as informações antes de importar.
        </DialogDescription>
      </DialogHeader>
      <div className="flex-grow space-y-4 p-1 overflow-y-auto min-h-0">
        <div className="space-y-2">
          <Label htmlFor="statement-image">Imagem do Extrato</Label>
          <div className="flex items-center gap-2">
            <Input
              id="statement-image"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="flex-grow"
              disabled={isProcessingImage || isSaving}
            />
            {imagePreviewUrl && (
              <Button variant="outline" size="icon" onClick={handleClearImage} disabled={isProcessingImage || isSaving} title="Limpar imagem">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          {imagePreviewUrl && (
            <div className="mt-2 border rounded-md p-2 flex justify-center bg-muted/30">
              <img src={imagePreviewUrl} alt="Prévia do Extrato" className="max-h-40 object-contain" />
            </div>
          )}
        </div>

        {imageFile && (
          <Button onClick={handleExtractTransactions} disabled={isProcessingImage || isSaving || !imageFile} className="w-full">
            {isProcessingImage ? <Sun className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
            {isProcessingImage ? 'Extraindo Transações...' : 'Extrair Transações da Imagem'}
          </Button>
        )}

        {extractionResult && editableTransactions.length > 0 && (
          <div key={extractionAttemptId} className="space-y-4 flex-grow min-h-0 flex flex-col"> 
            <div className="p-2 border rounded-md bg-muted/20 text-sm">
              {extractionResult.accountName && <p><strong>Conta/Banco:</strong> {extractionResult.accountName}</p>}
              {extractionResult.statementPeriod && <p><strong>Período do Extrato:</strong> {extractionResult.statementPeriod}</p>}
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <Label htmlFor="default-date-import" className="whitespace-nowrap">Data Padrão para Importação:</Label>
              <DatePicker
                value={defaultDate}
                onChange={(date) => setDefaultDate(date)}
                buttonClassName="w-full sm:w-auto"
              />
            </div>

            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Revise com Atenção!</AlertTitle>
                <AlertDescription>
                    Verifique os dados extraídos e ajuste o tipo, data e categoria antes de importar.
                    A IA pode cometer erros. Certifique-se que os valores de despesa são negativos e receitas positivos.
                </AlertDescription>
            </Alert>

            <ScrollArea className="flex-grow min-h-0 border rounded-md">
              <div className="space-y-3 p-3">
                {editableTransactions.map((tx) => (
                  <Card key={tx.id} className="p-3 space-y-2 text-xs shadow-sm">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`select-${tx.id}`}
                        checked={tx.isSelected}
                        onCheckedChange={(checked) => handleTransactionFieldChange(tx.id, 'isSelected', !!checked)}
                        disabled={isSaving}
                      />
                      <div className="flex-grow">
                        <Label htmlFor={`desc-${tx.id}`} className="text-xs font-normal">Descrição Original</Label>
                        <p className="text-xs text-muted-foreground truncate" title={tx.rawText || undefined}>{tx.rawText}</p>
                        <Input
                          id={`desc-${tx.id}`}
                          value={tx.userDescription}
                          onChange={(e) => handleTransactionFieldChange(tx.id, 'userDescription', e.target.value)}
                          placeholder="Descrição da Transação"
                          className="h-8 mt-0.5"
                          disabled={isSaving}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      <div>
                        <Label htmlFor={`amount-${tx.id}`} className="text-xs">Valor (R$)</Label>
                        <Input
                          id={`amount-${tx.id}`}
                          type="number"
                          step="0.01"
                          value={tx.userAmount === null ? '' : tx.userAmount}
                          onChange={(e) => handleTransactionFieldChange(tx.id, 'userAmount', e.target.value === '' ? null : parseFloat(e.target.value))}
                          placeholder="0.00"
                          className="h-8"
                          disabled={isSaving}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`type-${tx.id}`} className="text-xs">Tipo</Label>
                        <Select
                          value={tx.userSelectedType}
                          onValueChange={(value) => handleTransactionFieldChange(tx.id, 'userSelectedType', value)}
                          disabled={isSaving}
                        >
                          <SelectTrigger id={`type-${tx.id}`} className="h-8">
                            <SelectValue placeholder="Selecione o Tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="expense">Despesa</SelectItem>
                            <SelectItem value="income">Receita</SelectItem>
                            <SelectItem value="unknown" disabled>Desconhecido (IA)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`date-${tx.id}`} className="text-xs">Data</Label>
                        <DatePicker
                          value={tx.userSelectedDate || undefined}
                          onChange={(date) => handleTransactionFieldChange(tx.id, 'userSelectedDate', date)}
                          buttonClassName="h-8 w-full"
                          disabled={isSaving}
                        />
                      </div>
                    </div>
                     <div>
                        <Label htmlFor={`category-${tx.id}`} className="text-xs">Categoria</Label>
                        <Combobox
                            items={userCategories}
                            value={tx.userSelectedCategory}
                            onChange={(value) => handleTransactionFieldChange(tx.id, 'userSelectedCategory', value)}
                            onAddNewCategory={handleAddNewCategory}
                            placeholder="Selecione ou crie"
                            searchPlaceholder="Buscar ou criar..."
                            emptyMessage={isLoadingCategories ? "Carregando..." : "Nenhuma. Digite para criar."}
                            disabled={isLoadingCategories || isSaving}
                        />
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
        {extractionResult && editableTransactions.length === 0 && !isProcessingImage && (
             <p className="text-center text-muted-foreground py-4">Nenhuma transação foi identificada na imagem fornecida. Tente uma imagem mais nítida ou com formato diferente.</p>
        )}

      </div>
      <DialogFooter className="pt-4 border-t mt-auto p-6 bg-background sticky bottom-0">
        <DialogClose asChild>
          <Button variant="outline" disabled={isProcessingImage || isSaving}>Cancelar</Button>
        </DialogClose>
        <Button
          onClick={handleSaveSelectedTransactions}
          disabled={isProcessingImage || isSaving || editableTransactions.filter(tx => tx.isSelected).length === 0}
        >
          {isSaving ? <Sun className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {isSaving ? 'Salvando...' : `Adicionar (${editableTransactions.filter(tx => tx.isSelected).length}) Selecionadas`}
        </Button>
      </DialogFooter>
    </div>
  );
}
