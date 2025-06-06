
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
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Sun, Camera, Paperclip, ScanLine, Trash2, AlertTriangle, CreditCard as CreditCardIconLucide } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { addCreditCard, type NewCreditCardData, type AddCreditCardResult } from '@/lib/databaseService';
import { extractCardInfoFromImage } from '@/ai/flows/extract-card-info-flow';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const creditCardFormSchema = z.object({
  name: z.string().min(1, { message: 'O nome do cartão é obrigatório.' }).max(50, {message: 'O nome do cartão deve ter no máximo 50 caracteres.'}),
  limit: z.coerce
    .number({ invalid_type_error: 'O limite deve ser um número.', required_error: 'O limite é obrigatório.' })
    .positive({ message: 'O limite deve ser positivo.' })
    .min(1, { message: 'O limite deve ser maior que zero.' }),
  dueDateDay: z.coerce
    .number({ invalid_type_error: 'O dia de vencimento deve ser um número.', required_error: 'O dia de vencimento é obrigatório.' })
    .int({ message: 'O dia de vencimento deve ser um número inteiro.' })
    .min(1, { message: 'O dia de vencimento deve ser entre 1 e 31.' })
    .max(31, { message: 'O dia de vencimento deve ser entre 1 e 31.' }),
  closingDateDay: z.coerce
    .number({ invalid_type_error: 'O dia de fechamento deve ser um número.', required_error: 'O dia de fechamento é obrigatório.' })
    .int({ message: 'O dia de fechamento deve ser um número inteiro.' })
    .min(1, { message: 'O dia de fechamento deve ser entre 1 e 31.' })
    .max(31, { message: 'O dia de fechamento deve ser entre 1 e 31.' }),
  cardImageUri: z.string().nullable().optional(), // For storing image data if needed, not directly used by AI for all fields
});

type CreditCardFormValues = z.infer<typeof creditCardFormSchema>;

interface CreditCardFormProps {
  onSuccess?: () => void;
  setOpen: (open: boolean) => void;
  userId: string;
}

export function CreditCardForm({ onSuccess, setOpen, userId }: CreditCardFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Cleanup camera stream on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const form = useForm<CreditCardFormValues>({
    resolver: zodResolver(creditCardFormSchema),
    defaultValues: {
      name: '',
      limit: '' as unknown as number,
      dueDateDay: '' as unknown as number,
      closingDateDay: '' as unknown as number,
      cardImageUri: null,
    },
  });
  
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
      form.setValue('cardImageUri', null);
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
        form.setValue('cardImageUri', result);
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
        form.setValue('cardImageUri', dataUri);
      }
      stopCamera();
    }
  };
  
  const handleClearImage = () => {
    setImagePreviewUrl(null);
    form.setValue('cardImageUri', null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; 
    }
    stopCamera();
  };

  const handleExtractCardInfo = async () => {
    if (!imagePreviewUrl) {
      toast({ variant: 'destructive', title: 'Nenhuma Imagem', description: 'Capture ou carregue uma imagem do cartão primeiro.' });
      return;
    }
    setIsProcessingImage(true);
    try {
      const result = await extractCardInfoFromImage({ imageDataUri: imagePreviewUrl });
      let infoExtracted = false;
      if (result.suggestedCardName) {
        form.setValue('name', result.suggestedCardName);
        toast({ title: 'Informações Extraídas!', description: `Nome do cartão sugerido: "${result.suggestedCardName}". Verifique e complete os outros campos.` });
        infoExtracted = true;
      } else {
         toast({ title: 'Extração Parcial', description: 'Não foi possível sugerir um nome completo. Verifique as informações abaixo.' });
      }
      
      if (result.issuerName) form.setValue('name', form.getValues('name') || result.issuerName, { shouldValidate: true });
      // Note: The AI won't reliably get limit, due date, or closing date from a card image.
      // These will still need manual input.

      if (!infoExtracted && !result.issuerName && !result.cardNetwork && !result.cardProductName) {
         toast({ variant: 'destructive', title: 'Nenhuma Informação Encontrada', description: 'Não foi possível extrair detalhes do cartão da imagem. Por favor, preencha manualmente.' });
      }

    } catch (e: any) {
      console.error('Erro ao extrair informações do cartão:', e);
      toast({ variant: 'destructive', title: 'Erro na Extração', description: 'Ocorreu um erro ao processar a imagem do cartão.' });
    } finally {
      setIsProcessingImage(false);
    }
  };


  const onSubmit = async (values: CreditCardFormValues) => {
    setIsSubmitting(true);

    const creditCardData: NewCreditCardData = {
      name: values.name,
      limit: values.limit,
      dueDateDay: values.dueDateDay,
      closingDateDay: values.closingDateDay,
    };

    try {
      const result: AddCreditCardResult = await addCreditCard(userId, creditCardData);

      if (result.success && result.creditCardId) {
        toast({
          title: 'Sucesso!',
          description: 'Cartão de crédito adicionado com sucesso.',
        });
        form.reset();
        handleClearImage();
        if (onSuccess) onSuccess();
        setOpen(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao Adicionar Cartão',
          description: result.error || 'Ocorreu um erro desconhecido.',
        });
      }
    } catch (error: any) {
      const errorMessage = (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred.';
      console.error('Client-side error calling addCreditCard:', errorMessage);
      toast({
        variant: 'destructive',
        title: 'Erro de Comunicação',
        description: 'Ocorreu um erro ao salvar o cartão. Tente novamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        
        <Separator className="my-4" />
        <FormLabel>Ler Dados do Cartão via Imagem (Opcional)</FormLabel>
        <div className="space-y-3 p-3 border rounded-md">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={startCamera} disabled={isSubmitting || isProcessingImage || isCameraMode}>
              <Camera className="mr-2 h-4 w-4" /> Abrir Câmera
            </Button>
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting || isProcessingImage || isCameraMode}>
              <Paperclip className="mr-2 h-4 w-4" /> Carregar Imagem
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
                Para usar a câmera, conceda permissão no seu navegador ou carregue um arquivo.
              </AlertDescription>
            </Alert>
          )}

          {imagePreviewUrl && !isCameraMode && (
            <div className="space-y-2 mt-2">
              <img src={imagePreviewUrl} alt="Prévia do cartão" className="w-full max-h-48 object-contain rounded-md border" />
            </div>
          )}
          
          {(imagePreviewUrl || isCameraMode) && (
             <div className="flex flex-wrap gap-2 mt-2">
                {imagePreviewUrl && !isCameraMode && (
                    <Button type="button" variant="secondary" onClick={handleExtractCardInfo} disabled={isProcessingImage || isSubmitting} className="flex-grow">
                        {isProcessingImage ? <Sun className="mr-2 h-4 w-4 animate-spin" /> : <CreditCardIconLucide className="mr-2 h-4 w-4" />}
                        Extrair Dados do Cartão
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Cartão</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Nubank Ultravioleta" {...field} disabled={isSubmitting || isProcessingImage} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="limit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Limite (R$)</FormLabel>
              <FormControl>
                <Input lang="pt-BR" type="number" placeholder="R$ 5.000,00" {...field} step="0.01" disabled={isSubmitting || isProcessingImage} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="dueDateDay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dia do Vencimento</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Ex: 10" {...field} min="1" max="31" disabled={isSubmitting || isProcessingImage} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="closingDateDay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dia do Fechamento</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Ex: 1" {...field} min="1" max="31" disabled={isSubmitting || isProcessingImage} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>


        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={() => {stopCamera(); setOpen(false);}} disabled={isSubmitting || isProcessingImage}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || isProcessingImage}>
            {isSubmitting || isProcessingImage ? (
              <>
                <Sun className="mr-2 h-4 w-4 animate-spin" />
                {isProcessingImage ? 'Processando...' : 'Salvando...'}
              </>
            ) : (
              'Salvar Cartão'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
