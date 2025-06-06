
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Sun, Upload, AlertTriangle, FileImage, Trash2, ScanLine } from 'lucide-react';
import { extractStatementTransactionsFromImage } from '@/ai/flows/extract-statement-transactions-flow';
import type { ExtractStatementTransactionsOutput, ExtractedTransaction, UserCategory, NewTransactionData, TransactionType } from '@/types';
import { addTransaction, getCategoriesForUser, addCategoryForUser } from '@/lib/databaseService';
import { format, parseISO, isValid as isValidDate } from 'date-fns';

const IMPORTED_CATEGORY_NAME = "Importado";

interface ImportStatementDialogProps {
  userId: string;
  setOpen: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ImportStatementDialog({ userId, setOpen, onSuccess }: ImportStatementDialogProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // Combined state for extraction and saving
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(new Date());
  const [userCategories, setUserCategories] = useState<UserCategory[]>([]);
  const [importedCategoryId, setImportedCategoryId] = useState<string | null>(null);
  const [isLoadingPrerequisites, setIsLoadingPrerequisites] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchAndEnsureImportedCategory = useCallback(async () => {
    if (!userId) return;
    setIsLoadingPrerequisites(true);
    try {
      let categories = await getCategoriesForUser(userId);
      setUserCategories(categories);

      let importedCat = categories.find(c => c.name === IMPORTED_CATEGORY_NAME);
      if (!importedCat) {
        const result = await addCategoryForUser(userId, IMPORTED_CATEGORY_NAME, false);
        if (result.success && result.category) {
          importedCat = result.category;
          setUserCategories(prev => [...prev, result.category!].sort((a,b) => a.name.localeCompare(b.name)));
        } else {
          toast({ variant: "destructive", title: "Erro Crítico", description: `Não foi possível criar a categoria "${IMPORTED_CATEGORY_NAME}". A importação não pode continuar.` });
          setIsLoadingPrerequisites(false);
          return;
        }
      }
      setImportedCategoryId(importedCat.id);
    } catch (error) {
      console.error('Failed to fetch/create imported category:', error);
      toast({ variant: "destructive", title: "Erro ao Preparar Categorias", description: "Não foi possível carregar ou criar a categoria padrão para importação." });
    } finally {
      setIsLoadingPrerequisites(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchAndEnsureImportedCategory();
  }, [fetchAndEnsureImportedCategory]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearImage = () => {
    setImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExtractAndImport = async () => {
    if (!imageFile || !imagePreviewUrl) {
      toast({ variant: 'destructive', title: 'Nenhuma Imagem', description: 'Por favor, carregue uma imagem do extrato.' });
      return;
    }
    if (isLoadingPrerequisites || !importedCategoryId) {
      toast({ variant: 'destructive', title: 'Preparando...', description: 'Aguarde a configuração da categoria de importação ou verifique erros anteriores.' });
      return;
    }

    setIsProcessing(true);

    let extractionResult: ExtractStatementTransactionsOutput | null = null;
    try {
      extractionResult = await extractStatementTransactionsFromImage({
        imageDataUri: imagePreviewUrl,
        defaultYear: defaultDate ? defaultDate.getFullYear() : new Date().getFullYear(),
      });
    } catch (error: any) {
      console.error('Error extracting transactions from image:', error);
      toast({ variant: 'destructive', title: 'Erro na Extração', description: error.message || 'Não foi possível processar a imagem.' });
      setIsProcessing(false);
      return;
    }

    if (!extractionResult || !extractionResult.transactions || extractionResult.transactions.length === 0) {
      toast({ title: 'Extração Concluída', description: 'Nenhuma transação encontrada ou identificada na imagem.' });
      setIsProcessing(false);
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const tx of extractionResult.transactions) {
      let transactionDate: Date | null = null;
      if (tx.date) {
        try {
          transactionDate = parseISO(tx.date);
          if (!isValidDate(transactionDate)) transactionDate = null;
        } catch (e) { transactionDate = null; }
      }
      transactionDate = transactionDate || defaultDate || new Date();
      
      const amount = tx.amount !== null && tx.amount !== undefined ? Math.abs(tx.amount) : 0;
      if (amount <= 0) {
        console.warn("Skipping transaction with zero or invalid amount:", tx);
        continue; 
      }

      let type: TransactionType | 'unknown' = 'unknown';
      if (tx.typeSuggestion && (tx.typeSuggestion === 'income' || tx.typeSuggestion === 'expense')) {
        type = tx.typeSuggestion;
      } else if (tx.amount !== null && tx.amount !== undefined) {
        if (tx.amount < 0) type = 'expense';
        else if (tx.amount > 0) type = 'income';
      }

      if (type === 'unknown') {
         console.warn("Skipping transaction with unknown type:", tx);
         errorCount++; 
         continue;
      }

      const newTxData: NewTransactionData = {
        amount: amount,
        date: format(transactionDate, 'yyyy-MM-dd'),
        type: type as TransactionType,
        category: importedCategoryId, // Use the ID of "Importado" category
        description: tx.description || tx.rawText || 'Transação Importada Automaticamente',
        recurrenceFrequency: 'none',
      };

      try {
        const result = await addTransaction(userId, newTxData);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          console.error(`Failed to save transaction "${newTxData.description}": ${result.error}`);
        }
      } catch (e) {
        errorCount++;
        console.error(`Exception saving transaction "${newTxData.description}":`, e);
      }
    }

    setIsProcessing(false);

    if (successCount > 0) {
      toast({ title: 'Importação Automática Concluída', description: `${successCount} transações salvas com sucesso na categoria "${IMPORTED_CATEGORY_NAME}".` });
      if (onSuccess) onSuccess();
    }
    if (errorCount > 0) {
      toast({ variant: 'destructive', title: 'Erros na Importação Automática', description: `${errorCount} transações não puderam ser salvas. Algumas podem ter sido puladas devido a dados insuficientes.` });
    }
    
    if (successCount > 0 && errorCount === 0) {
      setOpen(false);
    } else if (successCount === 0 && errorCount > 0) {
      // All failed or skipped, keep dialog open
    } else if (successCount > 0 && errorCount > 0) {
      // Partially successful, keep dialog open to show error toast
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Main content area */}
      <div className="flex-grow p-1 space-y-4 overflow-y-auto min-h-0">
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
              disabled={isProcessing || isLoadingPrerequisites}
            />
            {imagePreviewUrl && (
              <Button variant="outline" size="icon" onClick={handleClearImage} disabled={isProcessing || isLoadingPrerequisites} title="Limpar imagem">
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
          <div className="space-y-2">
            <Label htmlFor="default-date-import">Data Padrão para Importação (se não identificada na transação)</Label>
            <DatePicker
              value={defaultDate}
              onChange={(date) => setDefaultDate(date)}
              buttonClassName="w-full"
              disabled={isProcessing || isLoadingPrerequisites}
            />
          </div>
        )}

        {imageFile && (
          <Button onClick={handleExtractAndImport} disabled={isProcessing || isLoadingPrerequisites || !imageFile} className="w-full">
            {isProcessing ? <Sun className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
            {isProcessing ? 'Importando...' : 'Extrair e Importar Transações'}
          </Button>
        )}
         <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Importação Automática</AlertTitle>
            <AlertDescription>
                As transações extraídas serão salvas automaticamente com a categoria "{IMPORTED_CATEGORY_NAME}".
                Valores serão salvos como positivos, e o tipo (receita/despesa) será inferido.
                Transações com dados insuficientes (sem valor ou tipo claro) podem ser puladas.
            </AlertDescription>
        </Alert>
      </div>

      <DialogFooter className="pt-4 mt-auto border-t p-6 bg-background">
        <DialogClose asChild>
          <Button variant="outline" disabled={isProcessing}>Cancelar</Button>
        </DialogClose>
        {/* The main action button is now "Extrair e Importar" */}
      </DialogFooter>
    </div>
  );
}
