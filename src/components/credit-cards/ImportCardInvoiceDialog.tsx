
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Sun, Upload, AlertTriangle, FileImage, Trash2, ScanLine, CreditCard as CreditCardIconLucide } from 'lucide-react';
import { extractCardInvoiceItemsFromImage } from '@/ai/flows/extract-card-invoice-items-flow';
import type { ExtractCardInvoiceOutput, ExtractedInvoiceItem, UserCategory, NewCreditCardPurchaseData, CreditCard } from '@/types';
import { addCreditCardPurchase, getCategoriesForUser, addCategoryForUser } from '@/lib/databaseService';
import { format, parseISO, isValid as isValidDate, getYear, getMonth } from 'date-fns';
import { Card } from '../ui/card'; // Assuming Card component is available

interface EditableExtractedInvoiceItem extends ExtractedInvoiceItem {
  id: string; // For unique key in UI
  isSelected: boolean;
  userSelectedDate: Date | null;
  userSelectedCategory: string;
  userDescription: string;
  userAmount: number | null;
  userInstallments: number;
}

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
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractCardInvoiceOutput | null>(null);
  const [editableItems, setEditableItems] = useState<EditableExtractedInvoiceItem[]>([]);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(new Date());
  const [userCategories, setUserCategories] = useState<UserCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar suas categorias.' });
    } finally {
      setIsLoadingCategories(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchUserCategories();
    if (userCreditCards.length > 0) {
      setSelectedCardId(userCreditCards[0].id);
    }
  }, [fetchUserCategories, userCreditCards]);

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
      setEditableItems([]);
    }
  };

  const handleClearImage = () => {
    setImageFile(null);
    setImagePreviewUrl(null);
    setExtractionResult(null);
    setEditableItems([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExtractItems = async () => {
    if (!imageFile || !imagePreviewUrl) {
      toast({ variant: 'destructive', title: 'Nenhuma Imagem', description: 'Por favor, carregue uma imagem da fatura.' });
      return;
    }
    if (!selectedCardId) {
      toast({ variant: 'destructive', title: 'Nenhum Cartão Selecionado', description: 'Selecione um cartão de crédito para associar as compras.' });
      return;
    }
    setIsProcessingImage(true);
    setExtractionResult(null);
    setEditableItems([]);

    // Try to infer defaultMonthYear from invoice closing/due date if card selected
    let defaultMonthYearForAI: string | undefined = undefined;
    const selectedCard = userCreditCards.find(c => c.id === selectedCardId);
    if (selectedCard) {
        // This is a heuristic. Faturas geralmente são do mês anterior ao vencimento.
        // We'll use the current month as a default if defaultDate is set, or based on card's due date.
        const invoiceMonth = getMonth(defaultDate || new Date()); // 0-indexed
        const invoiceYear = getYear(defaultDate || new Date());
        defaultMonthYearForAI = `${String(invoiceMonth + 1).padStart(2, '0')}/${invoiceYear}`;
    }


    try {
      const result = await extractCardInvoiceItemsFromImage({
        imageDataUri: imagePreviewUrl,
        defaultMonthYear: defaultMonthYearForAI,
      });
      setExtractionResult(result);
      if (result.items && result.items.length > 0) {
        setEditableItems(
          result.items.map((item, index) => {
            let parsedDate: Date | null = null;
            if (item.date) {
                try {
                    parsedDate = parseISO(item.date);
                    if (!isValidDate(parsedDate)) parsedDate = null;
                } catch (e) { parsedDate = null; }
            }
            return {
              ...item,
              id: `extracted-item-${index}-${Date.now()}`,
              isSelected: true,
              userSelectedDate: parsedDate || defaultDate || new Date(),
              userSelectedCategory: '',
              userDescription: item.description || item.rawText || '',
              userAmount: item.amount,
              userInstallments: 1, // Default to 1 installment
            };
          })
        );
        toast({ title: 'Extração Concluída', description: `${result.items.length} itens encontrados. Revise e confirme.` });
      } else {
        toast({ title: 'Extração Concluída', description: 'Nenhum item encontrado na imagem da fatura.' });
      }
    } catch (error: any) {
      console.error('Error extracting items from invoice image:', error);
      toast({ variant: 'destructive', title: 'Erro na Extração', description: error.message || 'Não foi possível processar a imagem.' });
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleItemFieldChange = (id: string, field: keyof EditableExtractedInvoiceItem, value: any) => {
    setEditableItems(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
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


  const handleSaveSelectedItems = async () => {
    if (!selectedCardId) {
      toast({ variant: 'destructive', title: 'Cartão Não Selecionado', description: 'Por favor, selecione o cartão de crédito desta fatura.' });
      return;
    }
    const itemsToSave = editableItems.filter(item => item.isSelected);
    if (itemsToSave.length === 0) {
      toast({ title: 'Nenhum Item Selecionado', description: 'Marque os itens que deseja importar.' });
      return;
    }

    let allValid = true;
    for (const item of itemsToSave) {
      if (!item.userAmount || item.userAmount <= 0) {
        toast({ variant: 'destructive', title: 'Valor Inválido', description: `Item "${item.userDescription}" tem valor inválido.` });
        allValid = false; break;
      }
      if (!item.userSelectedDate) {
        toast({ variant: 'destructive', title: 'Data Inválida', description: `Item "${item.userDescription}" não tem data.` });
        allValid = false; break;
      }
      if (!item.userSelectedCategory) {
        toast({ variant: 'destructive', title: 'Categoria Inválida', description: `Selecione a categoria para "${item.userDescription}".` });
        allValid = false; break;
      }
       if (item.userInstallments < 1 || !Number.isInteger(item.userInstallments)) {
        toast({ variant: 'destructive', title: 'Parcelas Inválidas', description: `Número de parcelas para "${item.userDescription}" deve ser um inteiro positivo.` });
        allValid = false; break;
      }
    }

    if (!allValid) return;

    setIsSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const item of itemsToSave) {
      const newPurchaseData: NewCreditCardPurchaseData = {
        cardId: selectedCardId,
        date: format(item.userSelectedDate!, 'yyyy-MM-dd'),
        description: item.userDescription,
        category: item.userSelectedCategory,
        totalAmount: item.userAmount!,
        installments: item.userInstallments,
      };
      try {
        const result = await addCreditCardPurchase(userId, newPurchaseData);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          console.error(`Failed to save purchase "${item.userDescription}": ${result.error}`);
        }
      } catch (e) {
        errorCount++;
        console.error(`Exception saving purchase "${item.userDescription}":`, e);
      }
    }
    setIsSaving(false);

    if (successCount > 0) {
      toast({ title: 'Importação Concluída', description: `${successCount} compras salvas com sucesso.` });
      if (onSuccess) onSuccess();
    }
    if (errorCount > 0) {
      toast({ variant: 'destructive', title: 'Erros na Importação', description: `${errorCount} compras não puderam ser salvas. Verifique o console.` });
    }
    if (successCount > 0 && errorCount === 0) {
      setOpen(false);
    } else if (successCount > 0 && errorCount > 0) {
      setEditableItems(prev => prev.filter(item => !item.isSelected || itemsToSave.find(saved => saved.id === item.id && errorCount > 0)));
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Importar Itens da Fatura do Cartão</DialogTitle>
        <DialogDescription>
          Envie uma imagem da sua fatura de cartão de crédito. A IA tentará identificar os itens.
          Revise e ajuste as informações antes de importar.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 p-1 max-h-[calc(85vh-200px)] overflow-hidden flex flex-col">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <Label htmlFor="credit-card-select">Cartão de Crédito</Label>
                <Select value={selectedCardId} onValueChange={setSelectedCardId} disabled={isProcessingImage || isSaving || userCreditCards.length === 0}>
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
                    disabled={isProcessingImage || isSaving}
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
              <img src={imagePreviewUrl} alt="Prévia da Fatura" className="max-h-40 object-contain" />
            </div>
          )}
        </div>

        {imageFile && (
          <Button onClick={handleExtractItems} disabled={isProcessingImage || isSaving || !imageFile || !selectedCardId} className="w-full">
            {isProcessingImage ? <Sun className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
            {isProcessingImage ? 'Extraindo Itens...' : 'Extrair Itens da Fatura'}
          </Button>
        )}

        {extractionResult && editableItems.length > 0 && (
          <div className="space-y-4 flex-grow min-h-0 overflow-hidden flex flex-col">
            <div className="p-2 border rounded-md bg-muted/20 text-sm">
              {extractionResult.cardNameHint && <p><strong>Cartão (Extrato):</strong> {extractionResult.cardNameHint}</p>}
              {extractionResult.cardLastDigits && <p><strong>Final:</strong> {extractionResult.cardLastDigits}</p>}
              {extractionResult.billingPeriod && <p><strong>Período:</strong> {extractionResult.billingPeriod}</p>}
            </div>
            
            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Revise com Atenção!</AlertTitle>
                <AlertDescription>
                    Verifique os dados extraídos e ajuste data, categoria, valor e número de parcelas antes de importar.
                </AlertDescription>
            </Alert>

            <ScrollArea className="flex-grow min-h-0 border rounded-md">
              <div className="space-y-3 p-3">
                {editableItems.map((item) => (
                  <Card key={item.id} className="p-3 space-y-2 text-xs shadow-sm">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`select-item-${item.id}`}
                        checked={item.isSelected}
                        onCheckedChange={(checked) => handleItemFieldChange(item.id, 'isSelected', !!checked)}
                        disabled={isSaving}
                      />
                      <div className="flex-grow">
                        <Label htmlFor={`desc-item-${item.id}`} className="text-xs font-normal">Descrição Original</Label>
                        <p className="text-xs text-muted-foreground truncate" title={item.rawText || undefined}>{item.rawText}</p>
                        <Input
                          id={`desc-item-${item.id}`}
                          value={item.userDescription}
                          onChange={(e) => handleItemFieldChange(item.id, 'userDescription', e.target.value)}
                          placeholder="Descrição da Compra"
                          className="h-8 mt-0.5"
                          disabled={isSaving}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 items-end">
                      <div>
                        <Label htmlFor={`amount-item-${item.id}`} className="text-xs">Valor (R$)</Label>
                        <Input
                          id={`amount-item-${item.id}`}
                          type="number"
                          step="0.01"
                          value={item.userAmount === null ? '' : item.userAmount}
                          onChange={(e) => handleItemFieldChange(item.id, 'userAmount', e.target.value === '' ? null : parseFloat(e.target.value))}
                          placeholder="0.00"
                          className="h-8"
                          disabled={isSaving}
                        />
                      </div>
                       <div>
                        <Label htmlFor={`installments-item-${item.id}`} className="text-xs">Parcelas</Label>
                        <Input
                          id={`installments-item-${item.id}`}
                          type="number"
                          step="1"
                          min="1"
                          value={item.userInstallments}
                          onChange={(e) => handleItemFieldChange(item.id, 'userInstallments', parseInt(e.target.value, 10) || 1)}
                          className="h-8"
                          disabled={isSaving}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`date-item-${item.id}`} className="text-xs">Data da Compra</Label>
                        <DatePicker
                          value={item.userSelectedDate || undefined}
                          onChange={(date) => handleItemFieldChange(item.id, 'userSelectedDate', date)}
                          buttonClassName="h-8 w-full"
                          disabled={isSaving}
                        />
                      </div>
                    </div>
                     <div>
                        <Label htmlFor={`category-item-${item.id}`} className="text-xs">Categoria</Label>
                        <Combobox
                            items={userCategories}
                            value={item.userSelectedCategory}
                            onChange={(value) => handleItemFieldChange(item.id, 'userSelectedCategory', value)}
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
        {extractionResult && editableItems.length === 0 && !isProcessingImage && (
             <p className="text-center text-muted-foreground py-4">Nenhum item foi identificado na imagem da fatura. Tente uma imagem mais nítida.</p>
        )}
      </div>
      <DialogFooter className="pt-4 border-t mt-auto p-6 bg-background sticky bottom-0">
        <DialogClose asChild>
          <Button variant="outline" disabled={isProcessingImage || isSaving}>Cancelar</Button>
        </DialogClose>
        <Button
          onClick={handleSaveSelectedItems}
          disabled={isProcessingImage || isSaving || !selectedCardId || editableItems.filter(item => item.isSelected).length === 0}
        >
          {isSaving ? <Sun className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {isSaving ? 'Salvando...' : `Adicionar (${editableItems.filter(item => item.isSelected).length}) Selecionadas`}
        </Button>
      </DialogFooter>
    </>
  );
}

