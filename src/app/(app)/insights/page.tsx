
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Sun, AlertTriangle } from 'lucide-react';
import { generateFinancialInsights, type FinancialInsightsOutput } from '@/ai/flows/generate-financial-insights';
import type { FinancialDataInput } from '@/types'; // This type is for the AI flow input
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext'; 
import { getFinancialDataForUser } from '@/lib/databaseService';


export default function InsightsPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false); // For AI generation
  const [fetchingData, setFetchingData] = useState(true); // For fetching user financial data
  const [insights, setInsights] = useState<FinancialInsightsOutput | null>(null);
  const [error, setError] = useState<string | null>(null); // For AI generation error
  const { toast } = useToast();
  const [financialData, setFinancialData] = useState<FinancialDataInput | null>(null); // Data used for AI

  const loadFinancialData = useCallback(async () => {
    if (!user) {
      setFetchingData(false);
      setFinancialData(null);
      return;
    }
    setFetchingData(true);
    try {
      const data = await getFinancialDataForUser(user.id); 
      if (data) {
        setFinancialData(data);
      } else {
        toast({
          variant: 'destructive',
          title: 'Dados Não Encontrados',
          description: 'Não foi possível carregar seus dados financeiros.',
        });
        setFinancialData(null);
      }
    } catch (e: any) {
      const errorMessage = (e && typeof e.message === 'string') ? e.message : 'An unknown error occurred.';
      console.error('Erro ao buscar dados financeiros:', errorMessage);
      toast({
        variant: 'destructive',
        title: 'Erro ao Carregar Dados',
        description: 'Falha ao buscar seus dados financeiros.',
      });
      setFinancialData(null);
    } finally {
      setFetchingData(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!authLoading) { // Only load data once auth status is resolved
        loadFinancialData();
    }
  }, [authLoading, loadFinancialData]);


  const handleGenerateInsights = async () => {
    if (!financialData) {
      toast({
        variant: 'destructive',
        title: 'Dados Insuficientes',
        description: 'Não foi possível carregar seus dados financeiros para gerar insights.',
      });
      return;
    }
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Usuário não autenticado',
        description: 'Por favor, faça login para gerar insights.',
      });
      return;
    }

    setLoading(true);
    setError(null);
    setInsights(null);

    try {
      const result = await generateFinancialInsights(financialData); // financialData is already user-specific
      setInsights(result);
      toast({
        title: 'Insights Gerados!',
        description: 'Suas dicas financeiras personalizadas estão prontas.',
      });
    } catch (e: any) {
      const errorMessage = (e && typeof e.message === 'string') ? e.message : 'An unknown error occurred.';
      console.error('Erro ao gerar insights:', errorMessage);
      setError('Falha ao gerar insights. Tente novamente mais tarde.');
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível gerar os insights financeiros.',
      });
    } finally {
      setLoading(false);
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
        <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center">
          <Sparkles className="mr-3 h-8 w-8 text-primary" />
          Insights Financeiros com IA
        </h1>
        <p className="text-muted-foreground">
          Receba dicas personalizadas para otimizar suas finanças.
        </p>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Seus Dados Financeiros</CardTitle>
          <CardDescription>
            Estes são os dados que serão usados para gerar seus insights. Eles são baseados nas suas transações, empréstimos e cartões registrados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fetchingData ? (
            <div className="flex items-center space-x-2">
              <Sun className="h-5 w-5 animate-spin" />
              <p className="text-muted-foreground">Carregando dados financeiros...</p>
            </div>
          ) : financialData ? (
            <div className="space-y-2">
              <Label htmlFor="financialDataPreview">Dados para Análise (JSON)</Label>
              <Textarea
                id="financialDataPreview"
                readOnly
                value={JSON.stringify(financialData, null, 2)}
                className="h-48 font-mono text-xs bg-muted/30"
              />
            </div>
          ) : (
             <p className="text-muted-foreground">Não foi possível carregar os dados financeiros. Verifique se você registrou transações, empréstimos e cartões.</p>
          )}
          <Button onClick={handleGenerateInsights} disabled={loading || fetchingData || !financialData || !user} className="mt-4 w-full md:w-auto">
            {loading ? (
              <Sun className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Gerar Insights
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive bg-destructive/10 shadow-lg">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Ocorreu um Erro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {insights && (
        <Card className="shadow-xl bg-primary/5 border-primary">
          <CardHeader>
            <CardTitle className="font-headline text-primary">Suas Dicas Personalizadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-2">Resumo Financeiro:</h3>
              <p className="text-foreground/90 whitespace-pre-wrap">{insights.summary}</p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Dicas para Economizar:</h3>
              <ul className="list-disc pl-5 space-y-2 text-foreground/90">
                {insights.savingTips.map((tip, index) => (
                  <li key={index}>{tip}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
