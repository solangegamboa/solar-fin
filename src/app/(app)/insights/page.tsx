
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { generateFinancialInsights, type FinancialInsightsOutput } from '@/ai/flows/generate-financial-insights';
import type { FinancialDataInput } from '@/types'; // Updated import for FinancialDataInput
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getFinancialDataForUser } from '@/lib/databaseService'; // New server action to fetch local data


export default function InsightsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [insights, setInsights] = useState<FinancialInsightsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [financialData, setFinancialData] = useState<FinancialDataInput | null>(null);

  useEffect(() => {
    async function loadFinancialData() {
      if (user?.uid) {
        setFetchingData(true);
        try {
          const data = await getFinancialDataForUser(user.uid);
          if (data) {
            setFinancialData(data);
          } else {
            toast({
              variant: 'destructive',
              title: 'Dados Não Encontrados',
              description: 'Não foi possível carregar seus dados financeiros do arquivo local.',
            });
            setFinancialData(null); // Explicitly set to null if not found or error
          }
        } catch (e: any) {
          const errorMessage = (e && typeof e.message === 'string') ? e.message : 'An unknown error occurred while fetching financial data.';
          console.error('Erro ao buscar dados financeiros locais:', errorMessage);
          toast({
            variant: 'destructive',
            title: 'Erro ao Carregar Dados',
            description: 'Falha ao buscar seus dados financeiros.',
          });
          setFinancialData(null);
        } finally {
          setFetchingData(false);
        }
      } else {
        setFetchingData(false);
        setFinancialData(null); // Clear data if no user
      }
    }
    loadFinancialData();
  }, [user, toast]);


  const handleGenerateInsights = async () => {
    if (!financialData) {
      toast({
        variant: 'destructive',
        title: 'Dados Insuficientes',
        description: 'Não foi possível carregar seus dados financeiros para gerar insights.',
      });
      return;
    }

    setLoading(true);
    setError(null);
    setInsights(null);

    try {
      const result = await generateFinancialInsights(financialData);
      setInsights(result);
      toast({
        title: 'Insights Gerados!',
        description: 'Suas dicas financeiras personalizadas estão prontas.',
      });
    } catch (e: any) {
      const errorMessage = (e && typeof e.message === 'string') ? e.message : 'An unknown error occurred while generating insights.';
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
          <CardTitle>Seus Dados Financeiros (do Arquivo Local)</CardTitle>
          <CardDescription>
            Estes são os dados que serão usados para gerar seus insights. Eles são carregados do seu arquivo local `db.json`.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fetchingData ? (
            <div className="flex items-center space-x-2">
              <Loader2 className="h-5 w-5 animate-spin" />
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
             <p className="text-muted-foreground">Não foi possível carregar os dados financeiros. Verifique se você está logado ou se os dados existem.</p>
          )}
          <Button onClick={handleGenerateInsights} disabled={loading || fetchingData || !financialData} className="mt-4 w-full md:w-auto">
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
