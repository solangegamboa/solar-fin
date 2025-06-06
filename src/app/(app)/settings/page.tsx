
'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/core/ThemeToggle";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Info, Sun, KeyRound, UserCircle2, Download, Upload, AlertTriangle as AlertTriangleIcon, Database } from 'lucide-react';
import type { AuthApiResponse, UserBackupData } from '@/types';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';


type DataStorageMode = "local" | "postgres";

const displayNameSchema = z.object({
  displayName: z.string().min(1, "Nome de exibição é obrigatório.").max(50, "Máximo de 50 caracteres."),
});
type DisplayNameFormValues = z.infer<typeof displayNameSchema>;

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual é obrigatória."),
  newPassword: z.string().min(6, "Nova senha deve ter pelo menos 6 caracteres."),
  confirmNewPassword: z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: "As novas senhas não coincidem.",
  path: ["confirmNewPassword"],
});
type PasswordChangeFormValues = z.infer<typeof passwordChangeSchema>;


export default function SettingsPage() {
  const { user, loading: authLoading, updateUserContext, logout } = useAuth();
  const { toast } = useToast();
  const [currentServerDbMode, setCurrentServerDbMode] = useState<DataStorageMode | null>(null);
  const [isLoadingDbMode, setIsLoadingDbMode] = useState(true);
  const [isDisplayNameSubmitting, setIsDisplayNameSubmitting] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isRestoreLoading, setIsRestoreLoading] = useState(false);
  const [selectedRestoreFile, setSelectedRestoreFile] = useState<File | null>(null);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  const displayNameForm = useForm<DisplayNameFormValues>({
    resolver: zodResolver(displayNameSchema),
    defaultValues: {
      displayName: user?.displayName || '',
    },
  });

  const passwordChangeForm = useForm<PasswordChangeFormValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  useEffect(() => {
    if (user) {
      displayNameForm.reset({ displayName: user.displayName || '' });
    }
  }, [user, displayNameForm]);

  useEffect(() => {
    const fetchDbMode = async () => {
      setIsLoadingDbMode(true);
      try {
        const response = await fetch('/api/system/db-mode');
        if (response.ok) {
          const data = await response.json();
          setCurrentServerDbMode(data.mode as DataStorageMode);
        } else {
          setCurrentServerDbMode('local'); // Fallback
          toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível identificar o modo de banco de dados do servidor.' });
        }
      } catch (error) {
        setCurrentServerDbMode('local'); // Fallback
        toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível conectar para verificar o modo do banco.' });
      } finally {
        setIsLoadingDbMode(false);
      }
    };
    fetchDbMode();
  }, [toast]);


  const handleUpdateDisplayName = async (values: DisplayNameFormValues) => {
    if (!user) return;
    setIsDisplayNameSubmitting(true);
    try {
      const response = await fetch('/api/user/update-display-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: values.displayName }),
      });
      const data: AuthApiResponse = await response.json();
      if (response.ok && data.success && data.user) {
        toast({ title: 'Sucesso!', description: 'Nome de exibição atualizado.' });
        updateUserContext({ displayName: data.user.displayName });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: data.message || 'Não foi possível atualizar o nome.' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível conectar ao servidor.' });
    } finally {
      setIsDisplayNameSubmitting(false);
    }
  };

  const handleChangePassword = async (values: PasswordChangeFormValues) => {
    if (!user) return;
    setIsPasswordSubmitting(true);
    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
      const data: AuthApiResponse = await response.json();
      if (response.ok && data.success) {
        toast({ title: 'Sucesso!', description: 'Senha alterada com sucesso.' });
        passwordChangeForm.reset();
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: data.message || 'Não foi possível alterar a senha.' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível conectar ao servidor.' });
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  const handleBackup = async () => {
    if (!user) return;
    setIsBackupLoading(true);
    try {
      const response = await fetch('/api/user/backup');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao gerar backup.');
      }
      const backupData: UserBackupData = await response.json();
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const userEmailPrefix = user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_');
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
      a.download = `solar_fin_backup_${userEmailPrefix}_${timestamp}.json`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Backup Gerado', description: 'O arquivo de backup foi baixado.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro no Backup', description: error.message || 'Não foi possível gerar o backup.' });
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedRestoreFile(event.target.files[0]);
    } else {
      setSelectedRestoreFile(null);
    }
  };

  const handleRestore = async () => {
    if (!user || !selectedRestoreFile) return;
    setIsRestoreLoading(true);
    try {
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        try {
          const backupData = JSON.parse(e.target?.result as string) as UserBackupData;
          if (!backupData.profile || !backupData.transactions) {
            throw new Error("Formato de arquivo de backup inválido.");
          }

          const response = await fetch('/api/user/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(backupData),
          });
          const result = await response.json();
          if (response.ok && result.success) {
            toast({ title: 'Restauração Concluída', description: 'Seus dados foram restaurados. Você será deslogado para aplicar as mudanças.' });
            setSelectedRestoreFile(null);
            if (restoreFileInputRef.current) restoreFileInputRef.current.value = "";
            setTimeout(() => {
                 logout();
            }, 2000);
          } else {
            throw new Error(result.message || 'Falha ao restaurar os dados.');
          }
        } catch (restoreError: any) {
          toast({ variant: 'destructive', title: 'Erro na Restauração', description: restoreError.message || 'Não foi possível restaurar os dados.' });
        } finally {
          setIsRestoreLoading(false);
        }
      };
      fileReader.onerror = () => {
        toast({ variant: 'destructive', title: 'Erro ao Ler Arquivo', description: 'Não foi possível ler o arquivo de backup.' });
        setIsRestoreLoading(false);
      };
      fileReader.readAsText(selectedRestoreFile);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro na Restauração', description: error.message || 'Ocorreu um erro inesperado.' });
      setIsRestoreLoading(false);
    }
  };


  if (authLoading) {
    return <div className="flex items-center justify-center h-64"><Sun className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Carregando...</p></div>;
  }
  if (!user && !authLoading) {
     return <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><AlertTriangleIcon className="h-12 w-12 mb-3" /><p className="text-lg">Por favor, faça login para acessar esta página.</p></div>;
  }


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as preferências da sua conta e do aplicativo.
        </p>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><UserCircle2 className="mr-2 h-5 w-5 text-primary" />Perfil</CardTitle>
          <CardDescription>Atualize suas informações pessoais.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...displayNameForm}>
            <form onSubmit={displayNameForm.handleSubmit(handleUpdateDisplayName)} className="space-y-4">
              <FormField
                control={displayNameForm.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="displayName">Nome de Exibição</FormLabel>
                    <FormControl>
                      <Input id="displayName" placeholder="Seu nome" {...field} disabled={isDisplayNameSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isDisplayNameSubmitting || authLoading}>
                {isDisplayNameSubmitting ? <Sun className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar Nome
              </Button>
            </form>
          </Form>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={user?.email || ''} disabled />
            <p className="text-xs text-muted-foreground">O email não pode ser alterado.</p>
          </div>
        </CardContent>
      </Card>

      <Separator />

       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><KeyRound className="mr-2 h-5 w-5 text-primary" />Alterar Senha</CardTitle>
          <CardDescription>Modifique sua senha de acesso.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordChangeForm}>
            <form onSubmit={passwordChangeForm.handleSubmit(handleChangePassword)} className="space-y-4">
              <FormField
                control={passwordChangeForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="currentPassword">Senha Atual</FormLabel>
                    <FormControl>
                      <Input id="currentPassword" type="password" placeholder="Sua senha atual" {...field} disabled={isPasswordSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordChangeForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="newPassword">Nova Senha</FormLabel>
                    <FormControl>
                      <Input id="newPassword" type="password" placeholder="Mínimo 6 caracteres" {...field} disabled={isPasswordSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordChangeForm.control}
                name="confirmNewPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="confirmNewPassword">Confirmar Nova Senha</FormLabel>
                    <FormControl>
                      <Input id="confirmNewPassword" type="password" placeholder="Repita a nova senha" {...field} disabled={isPasswordSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isPasswordSubmitting || authLoading}>
                {isPasswordSubmitting ? <Sun className="mr-2 h-4 w-4 animate-spin" /> : null}
                Alterar Senha
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
          <CardDescription>Personalize a aparência do aplicativo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Tema</Label>
              <p className="text-sm text-muted-foreground">
                Selecione o tema claro, escuro ou o padrão do sistema.
              </p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle className="flex items-center"><Download className="mr-2 h-5 w-5 text-primary"/>Backup e Restauração de Dados</CardTitle>
            <CardDescription>Faça backup ou restaure os dados da sua conta. A restauração substituirá seus dados atuais.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div>
                <h3 className="text-md font-medium mb-2">Backup Local</h3>
                <p className="text-sm text-muted-foreground mb-3">
                    Salve uma cópia de todos os seus dados (transações, empréstimos, cartões, etc.) em um arquivo JSON no seu computador.
                </p>
                <Button onClick={handleBackup} disabled={isBackupLoading || !user}>
                    {isBackupLoading ? <Sun className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Fazer Backup Local
                </Button>
            </div>
            <Separator />
            <div>
                <h3 className="text-md font-medium mb-2">Restaurar Backup Local</h3>
                <Alert variant="destructive" className="mb-3">
                    <AlertTriangleIcon className="h-4 w-4" />
                    <AlertTitle>Atenção!</AlertTitle>
                    <AlertDescription>
                        Restaurar um backup substituirá todos os seus dados financeiros atuais (transações, empréstimos, cartões, etc.) pelos dados do arquivo. Esta ação não pode ser desfeita.
                    </AlertDescription>
                </Alert>
                <div className="space-y-3">
                    <Input
                        type="file"
                        accept=".json"
                        onChange={handleFileSelect}
                        disabled={isRestoreLoading || !user}
                        ref={restoreFileInputRef}
                        className="max-w-sm"
                    />
                    {selectedRestoreFile && <p className="text-xs text-muted-foreground">Arquivo selecionado: {selectedRestoreFile.name}</p>}
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" disabled={isRestoreLoading || !selectedRestoreFile || !user}>
                                {isRestoreLoading ? <Sun className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                Restaurar do Arquivo
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Restauração</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Tem certeza que deseja restaurar os dados do arquivo "{selectedRestoreFile?.name || 'selecionado'}"? Todos os seus dados financeiros atuais serão substituídos. Esta ação é irreversível.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isRestoreLoading}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleRestore} disabled={isRestoreLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    {isRestoreLoading ? <Sun className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Confirmar Restauração
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><Database className="mr-2 h-5 w-5 text-primary" />Armazenamento de Dados</CardTitle>
          <CardDescription>
            Verifique como seus dados estão armazenados atualmente. A alteração real requer configuração de variáveis de ambiente e reinício do servidor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingDbMode ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-48" />
            </div>
          ) : (
            <RadioGroup value={currentServerDbMode || 'local'} disabled>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="local" id="dbLocal" />
                <Label htmlFor="dbLocal" className={currentServerDbMode === 'local' ? 'font-semibold' : ''}>
                  Arquivo Local (db.json) {currentServerDbMode === 'local' && <span className="text-primary ml-1">(Ativo)</span>}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="postgres" id="dbPostgres" />
                <Label htmlFor="dbPostgres" className={currentServerDbMode === 'postgres' ? 'font-semibold' : ''}>
                  Servidor PostgreSQL Externo {currentServerDbMode === 'postgres' && <span className="text-primary ml-1">(Ativo)</span>}
                </Label>
              </div>
            </RadioGroup>
          )}
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertTitle>Nota Importante</AlertTitle>
            <AlertDescription>
              A configuração acima mostra o modo de banco de dados atualmente ativo no servidor.
              Para alterar para PostgreSQL (ou voltar para local), você deve:
              <ol className="list-decimal list-inside mt-1 text-xs">
                <li>Configurar a variável de ambiente `DATABASE_URL` com sua string de conexão PostgreSQL (se for usar PostgreSQL).</li>
                <li>Definir a variável de ambiente `DATABASE_MODE` como "postgres" ou "local".</li>
                <li>Reiniciar o servidor da aplicação.</li>
                <li>Se estiver usando PostgreSQL, certifique-se de que as tabelas do banco de dados foram criadas. Você pode encontrar um script de inicialização em `sql/init.sql`.</li>
              </ol>
              A maioria das funcionalidades de dados (Perfil, Transações, Empréstimos, Cartões, Categorias) já foram adaptadas para funcionar com PostgreSQL.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Separator />
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-destructive">Excluir Conta</CardTitle>
          <CardDescription className="text-destructive/80">
            Esta ação é irreversível. Todos os seus dados serão permanentemente apagados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" disabled>Excluir Minha Conta (Desabilitado)</Button>
        </CardContent>
      </Card>
    </div>
  );
}
