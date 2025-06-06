
'use client';

import { useState, useEffect } from 'react';
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
import { Info, Sun, KeyRound, UserCircle2 } from 'lucide-react';
import type { AuthApiResponse } from '@/types';

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
  const { user, loading: authLoading, updateUserContext } = useAuth();
  const { toast } = useToast();
  const [selectedDbMode, setSelectedDbMode] = useState<DataStorageMode>("local");
  const [isDisplayNameSubmitting, setIsDisplayNameSubmitting] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

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


  if (authLoading) {
    return <div className="flex items-center justify-center h-64"><Sun className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Carregando...</p></div>;
  }
  if (!user && !authLoading) {
     return <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><AlertTriangle className="h-12 w-12 mb-3" /><p className="text-lg">Por favor, faça login para acessar esta página.</p></div>;
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
          <CardTitle>Armazenamento de Dados</CardTitle>
          <CardDescription>
            Escolha como seus dados são armazenados. A alteração real requer configuração de variáveis de ambiente e reinício do servidor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={selectedDbMode} onValueChange={(value) => setSelectedDbMode(value as DataStorageMode)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="local" id="dbLocal" />
              <Label htmlFor="dbLocal">Arquivo Local (db.json)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="postgres" id="dbPostgres" />
              <Label htmlFor="dbPostgres">Servidor PostgreSQL Externo</Label>
            </div>
          </RadioGroup>
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertTitle>Nota Importante</AlertTitle>
            <AlertDescription>
              Esta configuração é apenas visual. Para usar o PostgreSQL, você deve:
              <ol className="list-decimal list-inside mt-1 text-xs">
                <li>Configurar a variável de ambiente `DATABASE_URL` com sua string de conexão PostgreSQL.</li>
                <li>Definir a variável de ambiente `DATABASE_MODE="postgres"`.</li>
                <li>Reiniciar o servidor da aplicação.</li>
                <li>Certificar-se de que as tabelas do banco de dados foram criadas no seu servidor PostgreSQL (veja os esquemas conceituais em `src/lib/databaseService.ts`).</li>
              </ol>
              Atualmente, apenas as operações de Transações (criar, ler, excluir) foram adaptadas para PostgreSQL como exemplo. Outras funcionalidades (Empréstimos, Cartões) ainda utilizam o `db.json`.
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
