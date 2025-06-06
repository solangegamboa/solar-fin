
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SimpleInterestCalculator } from "@/components/calculators/SimpleInterestCalculator";
import { CompoundInterestCalculator } from "@/components/calculators/CompoundInterestCalculator";
import { Calculator as CalculatorIcon } from "lucide-react";

export default function CalculatorsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center">
            <CalculatorIcon className="mr-3 h-8 w-8 text-primary" />
            Calculadoras Financeiras
          </h1>
          <p className="text-muted-foreground">
            Realize cálculos de juros simples e compostos.
          </p>
        </div>
      </div>

      <Tabs defaultValue="simple_interest" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:max-w-md">
          <TabsTrigger value="simple_interest">Juros Simples</TabsTrigger>
          <TabsTrigger value="compound_interest">Juros Compostos</TabsTrigger>
        </TabsList>
        <TabsContent value="simple_interest" className="mt-6">
          <Card className="shadow-lg max-w-xl mx-auto">
            <CardHeader>
              <CardTitle>Calculadora de Juros Simples</CardTitle>
              <CardDescription>Calcule o rendimento ou custo de uma operação a juros simples.</CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleInterestCalculator />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="compound_interest" className="mt-6">
          <Card className="shadow-lg max-w-xl mx-auto">
            <CardHeader>
              <CardTitle>Calculadora de Juros Compostos</CardTitle>
              <CardDescription>Calcule o montante final de um investimento ou dívida a juros compostos.</CardDescription>
            </CardHeader>
            <CardContent>
              <CompoundInterestCalculator />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
