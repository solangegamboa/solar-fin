
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { getCategoriesForUser, addCategoryForUser } from '@/lib/databaseService';
import { useToast } from '@/hooks/use-toast';
import { Sun, Camera, Paperclip, ScanLine, Trash2, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { UserCategory, RecurrenceFrequency, Transaction, NewTransactionData, UpdateTransactionData } from '@/types';
import { Combobox } from '@/components/ui/combobox';
import { useAuth } from '@/contexts/AuthContext';
import { extractTransactionDetailsFromImage } from '@/ai/flows/extract-transaction-details-flow';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CurrencyInput } from '@/components/ui/currency-input';

const amountSchema = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      // Remove "R$", espaços, e pontos (como separador de milhar). Troca vírgula por ponto para decimal.
      const numStr = val.replace(/[R$\s.]/g, "").replace(",", ".");
      const num = parseFloat(numStr);
      return isNaN(num) ? val : num; // Retorna o valor original se não puder parsear, para Zod lidar. Ou NaN.
    }
    if (typeof val === 'number') {
      return val;
    }
    // Se for null ou undefined, z.number() (ou z.coerce.number() se fosse o caso) lidaria.
    // Para required_error funcionar bem, pode ser melhor retornar undefined se val for null ou empty string.
    if (val === null || val === '') return undefined;
    return val;
  },
  z.number({ required_error: 'O valor é obrigatório.', invalid_type_error: 'O valor deve ser um número válido.' })
    .positive({ message: 'O valor deve ser positivo.' })
    .min(0.01, { message: 'O valor deve ser maior que R$ 0,00.' }) // Ajustado para > 0.00
);


const transactionFormSchema = z.object({
  type: z.enum(['income', 'expense'], {
    required_error: 'O tipo da transação é obrigatório.',
  }),
  amount: amountSchema,
  category: z.string().min(1, { message: 'A categoria é obrigatória.' }).max(50, { message: 'A categoria deve ter no máximo 50 caracteres.'}),
  date: z.date({
    required_error: 'A data da transação é obrigatória.',
  }),
  description: z.string().max(200, { message: 'A descrição deve ter no máximo 200 caracteres.'}).optional(),
  recurrenceFrequency: z.enum(['none', 'monthly', 'weekly', 'annually']).default('none'),
  receiptImageUri: z.string().nullable().optional(),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

interface TransactionFormProps {
  onSuccess?: () => void;
  setOpen: (open: boolean) => void;
  userId: string;
  existingTransaction?: Transaction | null;
}

export function TransactionForm({ onSuccess, setOpen, userId, existingTransaction }: TransactionFormProps) {
  const { toast } = useToast();
  const { getToken } = useAuth(); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchCategories = useCallback(async () => {
    if (!userId) return;
    setIsLoadingCategories(true);
    try {
      const userCategories = await getCategoriesForUser(userId); 
      setCategories(userCategories);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar as categorias." });
    } finally {
      setIsLoadingCategories(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchCategories();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [fetchCategories]);
  
  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraMode(true);
      setImagePreviewUrl(null); 
      form.setValue('receiptImageUri', null);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Câmera Não Acessível',
        description: 'Por favor, habilite a permissão da câmera nas configurações do seu navegador.',
      });
      setIsCameraMode(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraMode(false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    stopCamera();
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreviewUrl(result);
        form.setValue('receiptImageUri', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCaptureFromCamera = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/png');
        setImagePreviewUrl(dataUri);
        form.setValue('receiptImageUri', dataUri);
      }
      stopCamera();
    }
  };
  
  const handleClearImage = () => {
    setImagePreviewUrl(null);
    form.setValue('receiptImageUri', null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; 
    }
    stopCamera();
  };

  const handleExtractAmount = async () => {
    if (!imagePreviewUrl) {
      toast({ variant: 'destructive', title: 'Nenhuma Imagem', description: 'Capture ou carregue uma imagem primeiro.' });
      return;
    }
    setIsProcessingImage(true);
    try {
      const result = await extractTransactionDetailsFromImage({ imageDataUri: imagePreviewUrl });
      if (result.extractedAmount !== null && typeof result.extractedAmount === 'number') {
        form.setValue('amount', result.extractedAmount, { shouldValidate: true });
        toast({ title: 'Valor Extraído!', description: `Valor R$ ${result.extractedAmount.toFixed(2)} preenchido.` });
      } else {
        toast({ variant: 'destructive', title: 'Valor Não Encontrado', description: 'Não foi possível extrair um valor da imagem.' });
      }
    } catch (e: any) {
      console.error('Erro ao extrair valor:', e);
      toast({ variant: 'destructive', title: 'Erro na Extração', description: 'Ocorreu um erro ao processar a imagem.' });
    } finally {
      setIsProcessingImage(false);
    }
  };

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
        type: undefined,
        amount: undefined,
        category: '',
        date: new Date(),
        description: '',
        recurrenceFrequency: 'none',
        receiptImageUri: null,
      },
  });

  useEffect(() => {
    if (existingTransaction) {
      form.reset({
        type: existingTransaction.type,
        amount: existingTransaction.amount,
        category: existingTransaction.category,
        date: existingTransaction.date ? parseISO(existingTransaction.date) : new Date(),
        description: existingTransaction.description || '',
        recurrenceFrequency: existingTransaction.recurrenceFrequency || 'none',
        receiptImageUri: existingTransaction.receiptImageUri || null,
      });
      if (existingTransaction.receiptImageUri) {
        setImagePreviewUrl(existingTransaction.receiptImageUri);
      } else {
        setImagePreviewUrl(null);
      }
    } else {
      form.reset({
        type: undefined,
        amount: undefined,
        category: '',
        date: new Date(),
        description: '',
        recurrenceFrequency: 'none',
        receiptImageUri: null,
      });
      setImagePreviewUrl(null);
    }
  }, [existingTransaction, form]);

  const handleAddNewCategory = async (categoryName: string): Promise<UserCategory | null> => {
    if (!userId) {
      toast({ variant: "destructive", title: "Erro", description: "Usuário não identificado." });
      return null;
    }
    const result = await addCategoryForUser(userId, categoryName);
    if (result.success && result.category) {
      setCategories(prev => [...prev, result.category!].sort((a, b) => a.name.localeCompare(b.name)));
      return result.category;
    } else {
      toast({ variant: "destructive", title: "Erro ao Adicionar Categoria", description: result.error || "Não foi possível salvar a nova categoria." });
      return null;
    }
  };

  const onSubmit = async (values: TransactionFormValues) => {
    setIsSubmitting(true);
    const token = getToken();
    if (!token) {
      toast({ variant: 'destructive', title: 'Erro de Autenticação', description: 'Sessão inválida. Faça login novamente.' });
      setIsSubmitting(false);
      return;
    }

    let result: { success: boolean; transactionId?: string; error?: string; message?: string };
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    // O valor 'amount' já foi processado pelo Zod e deve ser um número aqui
    const amountAsNumber = values.amount; 

    try {
      if (existingTransaction) {
        const updateData: UpdateTransactionData = {
            type: values.type,
            amount: amountAsNumber,
            category: values.category,
            date: format(values.date, 'yyyy-MM-dd'),
            description: values.description || undefined,
            recurrenceFrequency: values.recurrenceFrequency || 'none',
            receiptImageUri: imagePreviewUrl,
        };
        const response = await fetch(`/api/transactions/${existingTransaction.id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(updateData),
        });
        result = await response.json();
      } else {
        const transactionData: NewTransactionData = {
          type: values.type,
          amount: amountAsNumber,
          category: values.category,
          date: format(values.date, 'yyyy-MM-dd'),
          description: values.description || undefined,
          recurrenceFrequency: values.recurrenceFrequency || 'none',
          receiptImageUri: imagePreviewUrl,
        };
        const response = await fetch('/api/transactions', {
            method: 'POST',
            headers,
            body: JSON.stringify(transactionData),
        });
        result = await response.json();
      }

      if (result.success) {
        toast({
          title: 'Sucesso!',
          description: `Transação ${existingTransaction ? 'atualizada' : 'adicionada'} com sucesso.`,
        });
        form.reset({ 
            type: undefined, 
            amount: undefined, 
            category: '', 
            date: new Date(), 
            description: '', 
            recurrenceFrequency: 'none',
            receiptImageUri: null,
        });
        handleClearImage(); 
        if (onSuccess) onSuccess();
        setOpen(false);
      } else {
        toast({
          variant: 'destructive',
          title: existingTransaction ? 'Erro ao Atualizar' : 'Erro ao Adicionar',
          description: result.error || result.message || 'Ocorreu um erro desconhecido.',
        });
      }
    } catch (error: any) {
      const errorMessage = (error && typeof error.message === 'string') ? error.message : 'Ocorreu um erro desconhecido.';
      console.error('Client-side error during transaction submission:', errorMessage);
      const displayMessage = `Ocorreu um erro ao ${existingTransaction ? 'atualizar' : 'salvar'} a transação. Tente novamente.`;
      toast({
        variant: 'destructive',
        title: 'Erro de Comunicação',
        description: displayMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ''} disabled={isSubmitting || isProcessingImage}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo da transação" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator className="my-4" />
        <FormLabel>Anexar Comprovante (Opcional)</FormLabel>
        <div className="space-y-3 p-3 border rounded-md">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={startCamera} disabled={isSubmitting || isProcessingImage || isCameraMode}>
              <Camera className="mr-2 h-4 w-4" /> Abrir Câmera
            </Button>
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting || isProcessingImage || isCameraMode}>
              <Paperclip className="mr-2 h-4 w-4" /> Carregar Arquivo
            </Button>
            <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
          </div>

          {isCameraMode && (
            <div className="space-y-2">
              <video ref={videoRef} className="w-full aspect-video rounded-md bg-muted" autoPlay muted playsInline />
              <Button type="button" onClick={handleCaptureFromCamera} className="w-full" disabled={!hasCameraPermission}>
                <Camera className="mr-2 h-4 w-4" /> Capturar Foto
              </Button>
            </div>
          )}

          {hasCameraPermission === false && !isCameraMode && (
             <Alert variant="destructive" className="mt-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Permissão da Câmera Negada</AlertTitle>
              <AlertDescription>
                Para usar a câmera, você precisa conceder permissão nas configurações do seu navegador. Como alternativa, você pode carregar um arquivo.
              </AlertDescription>
            </Alert>
          )}

          {imagePreviewUrl && !isCameraMode && (
            <div className="space-y-2 mt-2">
              <img src={imagePreviewUrl} alt="Prévia do comprovante" className="w-full max-h-60 object-contain rounded-md border" />
            </div>
          )}
          
          {(imagePreviewUrl || isCameraMode) && (
             <div className="flex flex-wrap gap-2 mt-2">
                {imagePreviewUrl && !isCameraMode && (
                    <Button type="button" variant="secondary" onClick={handleExtractAmount} disabled={isProcessingImage || isSubmitting} className="flex-grow">
                        {isProcessingImage ? <Sun className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
                        Extrair Valor do Comprovante
                    </Button>
                )}
                <Button type="button" variant="destructive" onClick={handleClearImage} disabled={isProcessingImage || isSubmitting} className={imagePreviewUrl && !isCameraMode ? "" : "w-full"}>
                    <Trash2 className="mr-2 h-4 w-4" /> Limpar Imagem
                </Button>
             </div>
          )}
        </div>
        <Separator className="my-4" />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => ( // field includes value, onChange, onBlur, name, ref
            <FormItem>
              <FormLabel>Valor (R$)</FormLabel>
              <FormControl>
                <CurrencyInput
                  value={field.value} // Pass RHF's value to CurrencyInput
                  onChange={field.onChange} // Pass RHF's onChange to CurrencyInput
                  onBlur={field.onBlur} // Pass RHF's onBlur
                  name={field.name} // Pass RHF's name
                  ref={field.ref} // Pass RHF's ref
                  placeholder="R$ 0,00"
                  disabled={isSubmitting || isProcessingImage}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Categoria</FormLabel>
                <Combobox
                    items={categories}
                    value={field.value}
                    onChange={field.onChange}
                    onAddNewCategory={handleAddNewCategory}
                    placeholder="Selecione ou crie uma categoria"
                    searchPlaceholder="Buscar ou criar nova..."
                    emptyMessage={isLoadingCategories ? "Carregando categorias..." : "Nenhuma categoria. Digite para criar."}
                    disabled={isSubmitting || isLoadingCategories || !userId || isProcessingImage}
                />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Data</FormLabel>
                <DatePicker value={field.value} onChange={field.onChange} disabled={isSubmitting || isProcessingImage} />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição (Opcional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Adicione uma breve descrição..."
                  className="resize-none"
                  {...field}
                  disabled={isSubmitting || isProcessingImage}
                  value={field.value || ''} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="recurrenceFrequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Frequência da Recorrência</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || 'none'} disabled={isSubmitting || isProcessingImage}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a frequência" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">Não Recorrente</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="annually">Anual</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-2">
          <Button type="button" variant="outline" onClick={() => { stopCamera(); setOpen(false); }} disabled={isSubmitting || isProcessingImage}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || isLoadingCategories || !userId || isProcessingImage}>
            {isSubmitting || isLoadingCategories || isProcessingImage ? (
              <>
                <Sun className="mr-2 h-4 w-4 animate-spin" />
                {isLoadingCategories ? 'Carregando...' : (isProcessingImage ? 'Processando...' : 'Salvando...')}
              </>
            ) : (
              existingTransaction ? 'Salvar Alterações' : 'Salvar Transação'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
