
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Sun, Upload, AlertTriangle, FileImage, Trash2, ScanLine } from 'lucide-react';
import { extractCardInvoiceItemsFromImage } from '@/ai/flows/extract-card-invoice-items-flow';
import type { ExtractCardInvoiceOutput, UserCategory, NewCreditCardPurchaseData, CreditCard, CreditCardPurchase } from '@/types';
import { addCreditCardPurchase, getCategoriesForUser, addCategoryForUser, getCreditCardPurchasesForUser } from '@/lib/databaseService';
import { format, parseISO, isValid as isValidDate, getYear, getMonth } from 'date-fns';

const IMPORTED_CARD_CATEGORY_NAME = "Fatura Cartão";

interface ImportCardInvoiceDialogProps {
  userId: string;
  userCreditCards: CreditCard[];
  setOpen: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ImportCardInvoiceDialog({ userId, userCreditCards, setOpen, onSuccess }: ImportCardInvoiceDialogProps) {
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(new Date());
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [userCategories, setUserCategories] = useState<UserCategory[]>([]); // Still useful for ensuring category exists
  const [importedCardCategoryId, setImportedCardCategoryId] = useState<string | null>(null);
  const [isLoadingPrerequisites, setIsLoadingPrerequisites] = useState(true);
  const [extractionAttemptId, setExtractionAttemptId] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchAndEnsureImportedCardCategory = useCallback(async () => {
    if (!userId) return;
    setIsLoadingPrerequisites(true);
    try {
      let categories = await getCategoriesForUser(userId);
      setUserCategories(categories);

      let importedCat = categories.find(c => c.name === IMPORTED_CARD_CATEGORY_NAME);
      if (!importedCat) {
        const result = await addCategoryForUser(userId, IMPORTED_CARD_CATEGORY_NAME, false);
        if (result.success && result.category) {
          importedCat = result.category;
          setUserCategories(prev => [...prev, result.category!].sort((a,b) => a.name.localeCompare(b.name)));
        } else {
          toast({ variant: "destructive", title: "Erro Crítico", description: `Não foi possível criar a categoria "${IMPORTED_CARD_CATEGORY_NAME}". A importação não pode continuar.` });
          setIsLoadingPrerequisites(false);
          return;
        }
      }
      setImportedCardCategoryId(importedCat.id);
    } catch (error) {
      console.error('Failed to fetch/create imported card category:', error);
      toast({ variant: "destructive", title: "Erro ao Preparar Categorias", description: "Não foi possível carregar ou criar a categoria padrão para importação de fatura." });
    } finally {
      setIsLoadingPrerequisites(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchAndEnsureImportedCardCategory();
    if (userCreditCards.length > 0 && !selectedCardId) {
      setSelectedCardId(userCreditCards[0].id);
    }
  }, [fetchAndEnsureImportedCardCategory, userCreditCards, selectedCardId]);


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

  const handleExtractAndImportItems = async () => {
    if (!imageFile || !imagePreviewUrl) {
      toast({ variant: 'destructive', title: 'Nenhuma Imagem', description: 'Por favor, carregue uma imagem da fatura.' });
      return;
    }
    if (!selectedCardId) {
      toast({ variant: 'destructive', title: 'Nenhum Cartão Selecionado', description: 'Selecione um cartão de crédito para associar as compras.' });
      return;
    }
     if (isLoadingPrerequisites || !importedCardCategoryId) {
      toast({ variant: 'destructive', title: 'Preparando...', description: 'Aguarde a configuração da categoria de importação ou verifique erros anteriores.' });
      return;
    }
    setExtractionAttemptId(prev => prev + 1);
    setIsProcessing(true);

    let extractionResult: ExtractCardInvoiceOutput | null = null;
    let existingCardPurchases: CreditCardPurchase[] = [];

    let defaultMonthYearForAI: string | undefined = undefined;
    const selectedCard = userCreditCards.find(c => c.id === selectedCardId);
    if (selectedCard && defaultDate) {
        const invoiceMonth = getMonth(defaultDate); 
        const invoiceYear = getYear(defaultDate);
        defaultMonthYearForAI = `${String(invoiceMonth + 1).padStart(2, '0')}/${invoiceYear}`;
    }

    try {
      extractionResult = await extractCardInvoiceItemsFromImage({
        imageDataUri: imagePreviewUrl,
        defaultMonthYear: defaultMonthYearForAI,
      });
      existingCardPurchases = await getCreditCardPurchasesForUser(userId); // Fetch all purchases for the user
    } catch (error: any) {
      console.error('Error extracting items from invoice or fetching existing purchases:', error);
      toast({ variant: 'destructive', title: 'Erro na Extração/Preparação', description: error.message || 'Não foi possível processar a imagem ou buscar compras existentes.' });
      setIsProcessing(false);
      return;
    }

    if (!extractionResult || !extractionResult.items || extractionResult.items.length === 0) {
      toast({ title: 'Extração Concluída', description: 'Nenhum item encontrado ou identificado na imagem da fatura.' });
      setIsProcessing(false);
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    let skippedDuplicateCount = 0;

    const purchasesForSelectedCard = existingCardPurchases.filter(p => p.cardId === selectedCardId);

    for (const item of extractionResult.items) {
      let purchaseDate: Date | null = null;
      if (item.date) {
        try {
          purchaseDate = parseISO(item.date);
          if (!isValidDate(purchaseDate)) purchaseDate = null;
        } catch (e) { purchaseDate = null; }
      }
      purchaseDate = purchaseDate || defaultDate || new Date();
      
      const amount = item.amount !== null && item.amount !== undefined ? Math.abs(item.amount) : 0;
      if (amount <= 0) {
        console.warn("Skipping invoice item with zero or invalid amount:", item);
        continue;
      }

      const currentDescription = (item.description || item.rawText || 'Compra Importada Fatura').toLowerCase().trim();
      const currentAmount = parseFloat(amount.toFixed(2));
      const currentCategory = IMPORTED_CARD_CATEGORY_NAME.toLowerCase();

      const isDuplicate = purchasesForSelectedCard.some(existingPurchase => {
        const existingDescription = (existingPurchase.description || '').toLowerCase().trim();
        const existingAmount = parseFloat(existingPurchase.totalAmount.toFixed(2)); // Compare total amount, not installment
        const existingCategory = (existingPurchase.category || '').toLowerCase();
        
        return existingDescription === currentDescription &&
               existingCategory === currentCategory &&
               existingAmount === currentAmount &&
               existingPurchase.installments === 1; // Only consider it duplicate if it was also a 1-installment purchase
      });

      if (isDuplicate) {
        skippedDuplicateCount++;
        console.log(`Skipping duplicate card purchase: ${currentDescription}, Amount: ${currentAmount}`);
        continue;
      }

      const newPurchaseData: NewCreditCardPurchaseData = {
        cardId: selectedCardId,
        date: format(purchaseDate, 'yyyy-MM-dd'),
        description: item.description || item.rawText || 'Compra Importada Fatura',
        category: IMPORTED_CARD_CATEGORY_NAME,
        totalAmount: amount,
        installments: 1, // Default to 1 installment for simplicity
      };

      try {
        const result = await addCreditCardPurchase(userId, newPurchaseData);
        if (result.success && result.purchaseId) {
          successCount++;
          // Add to temp list to avoid re-importing within the same batch
          purchasesForSelectedCard.push({
            id: result.purchaseId,
            userId,
            ...newPurchaseData,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        } else {
          errorCount++;
          console.error(`Failed to save card purchase "${newPurchaseData.description}": ${result.error}`);
        }
      } catch (e) {
        errorCount++;
        console.error(`Exception saving card purchase "${newPurchaseData.description}":`, e);
      }
    }

    setIsProcessing(false);

    let summaryMessages: string[] = [];
    if (successCount > 0) {
      summaryMessages.push(`${successCount} compras salvas com sucesso na categoria "${IMPORTED_CARD_CATEGORY_NAME}" (com 1 parcela).`);
    }
    if (skippedDuplicateCount > 0) {
      summaryMessages.push(`${skippedDuplicateCount} compras foram puladas por serem duplicadas.`);
    }
    if (errorCount > 0) {
      summaryMessages.push(`${errorCount} compras não puderam ser salvas (algumas podem ter sido puladas por dados insuficientes).`);
    }
     if (summaryMessages.length === 0 && extractionResult.items.length > 0) {
        summaryMessages.push("Nenhuma compra nova foi importada. Verifique se já existem ou se os dados são válidos.");
    }

    if (summaryMessages.length > 0) {
      toast({
        title: 'Importação de Fatura Concluída',
        description: summaryMessages.join(' '),
        duration: successCount > 0 && errorCount === 0 && skippedDuplicateCount === 0 ? 5000 : 8000,
      });
    }

    if (onSuccess && successCount > 0) onSuccess();
    
    if (successCount > 0 && errorCount === 0 && skippedDuplicateCount === 0) {
      setOpen(false);
    }
  };


  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-grow min-h-0 space-y-4 overflow-y-auto p-1">
        <div className="space-y-4 px-0 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                  <Label htmlFor="credit-card-select">Cartão de Crédito da Fatura</Label>
                  <Select value={selectedCardId} onValueChange={setSelectedCardId} disabled={isProcessing || isLoadingPrerequisites || userCreditCards.length === 0}>
                      <SelectTrigger id="credit-card-select">
                      <SelectValue placeholder={userCreditCards.length > 0 ? "Selecione um cartão" : "Nenhum cartão cadastrado"} />
                      </SelectTrigger>
                      <SelectContent>
                      {userCreditCards.map(card => (
                          <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>
                      ))}
                      </SelectContent>
                  </Select>
                  {userCreditCards.length === 0 && <p className="text-xs text-destructive mt-1">Adicione um cartão de crédito primeiro.</p>}
              </div>
              <div>
                  <Label htmlFor="default-date-import">Data de Referência da Fatura</Label>
                  <DatePicker
                      value={defaultDate}
                      onChange={(date) => setDefaultDate(date)}
                      buttonClassName="w-full"
                      disabled={isProcessing || isLoadingPrerequisites}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Usada para ajudar a IA a inferir o ano/mês das compras.</p>
              </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-image">Imagem da Fatura</Label>
            <div className="flex items-center gap-2">
              <Input
                id="invoice-image"
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
                <img src={imagePreviewUrl} alt="Prévia da Fatura" className="max-h-40 object-contain" />
              </div>
            )}
          </div>
        </div>

        {imageFile && (
          <Button onClick={handleExtractAndImportItems} disabled={isProcessing || isLoadingPrerequisites || !imageFile || !selectedCardId} className="w-full">
            {isProcessing ? <Sun className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
            {isProcessing ? 'Importando...' : 'Extrair e Importar Itens'}
          </Button>
        )}
         <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Importação Automática de Fatura</AlertTitle>
            <AlertDescription>
                Os itens extraídos serão salvos automaticamente com a categoria "{IMPORTED_CARD_CATEGORY_NAME}" e com 1 parcela.
                Compras com dados insuficientes ou duplicadas (mesma descrição, categoria, valor e 1 parcela no cartão selecionado) serão puladas.
            </AlertDescription>
        </Alert>
      </div>

      <DialogFooter className="pt-4 border-t mt-auto bg-background p-6">
        <DialogClose asChild>
          <Button variant="outline" disabled={isProcessing}>Cancelar</Button>
        </DialogClose>
      </DialogFooter>
    </div>
  );
}
