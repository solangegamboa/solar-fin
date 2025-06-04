import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Landmark, CreditCardIcon, TrendingUp, TrendingDown } from "lucide-react";

export default function DashboardPage() {
  // Placeholder data - replace with actual data fetching
  const balance = 12540.50;
  const totalIncome = 5500.00;
  const totalExpenses = 2350.75;
  const savingsRate = ((totalIncome - totalExpenses) / totalIncome) * 100;

  const summaryCards = [
    { title: "Saldo Atual", value: balance, icon: DollarSign, currency: true, color: "text-primary" },
    { title: "Receitas do Mês", value: totalIncome, icon: TrendingUp, currency: true, color: "text-positive" },
    { title: "Despesas do Mês", value: totalExpenses, icon: TrendingDown, currency: true, color: "text-negative" },
    { title: "Taxa de Poupança", value: savingsRate, icon: Landmark, currency: false, unit: "%", color: "text-blue-500" },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Painel Financeiro</h1>
        <p className="text-muted-foreground">
          Resumo da sua saúde financeira este mês.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title} className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color || 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${card.color || ''}`}>
                {card.currency ? formatCurrency(card.value) : `${card.value.toFixed(2)}${card.unit || ''}`}
              </div>
              {/* <p className="text-xs text-muted-foreground">+20.1% from last month</p> */}
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline">Despesas por Categoria</CardTitle>
            <CardDescription>Distribuição dos seus gastos mensais.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Placeholder for chart */}
            <div className="h-[300px] flex items-center justify-center bg-muted/50 rounded-md">
              <p className="text-muted-foreground">Gráfico de Despesas em breve</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline">Próximas Contas</CardTitle>
            <CardDescription>Fique de olho nos seus próximos pagamentos.</CardDescription>
          </CardHeader>
          <CardContent>
             {/* Placeholder for upcoming bills list */}
            <div className="h-[300px] flex items-center justify-center bg-muted/50 rounded-md">
              <p className="text-muted-foreground">Lista de Próximas Contas em breve</p>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
