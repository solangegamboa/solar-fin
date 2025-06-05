
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/core/ThemeToggle";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from 'lucide-react';

type DataStorageMode = "local" | "postgres";

export default function SettingsPage() {
  // This state is for the UI representation only.
  // The actual DB mode is controlled by environment variables.
  const [selectedDbMode, setSelectedDbMode] = useState<DataStorageMode>("local");
  const [currentEnvDbMode, setCurrentEnvDbMode] = useState<string | null>(null);

  // In a real scenario, you might fetch the current DATABASE_MODE from an API endpoint
  // or have it passed as a prop if determined at build time.
  // For this prototype, we'll simulate it or leave it as a visual cue.
  // This useEffect is purely illustrative for a client-side component.
  useEffect(() => {
    // Simulate fetching/knowing the environment setting.
    // In a real app, this would be more complex if you need to display the actual server config.
    // For now, we'll just assume it might be 'local' or 'postgres' based on what the user *might* have set.
    // setSelectedDbMode(process.env.NEXT_PUBLIC_DATABASE_MODE || "local"); // Can't access process.env directly here
  }, []);


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
          <CardTitle>Perfil</CardTitle>
          <CardDescription>Atualize suas informações pessoais.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="displayName">Nome de Exibição</Label>
            <Input id="displayName" placeholder="Seu nome" defaultValue="Local User" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="seu@email.com" defaultValue="user@example.local" disabled />
            <p className="text-xs text-muted-foreground">O email não pode ser alterado.</p>
          </div>
          <Button>Salvar Alterações (Desabilitado)</Button>
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
          <Button variant="destructive">Excluir Minha Conta (Desabilitado)</Button>
        </CardContent>
      </Card>
    </div>
  );
}
