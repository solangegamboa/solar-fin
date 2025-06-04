import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";

export default function CreditCardsPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Cartões de Crédito</h1>
          <p className="text-muted-foreground">
            Gerencie seus cartões e compras parceladas.
          </p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Novo Cartão
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Seus Cartões</CardTitle>
          <CardDescription>Limites, vencimentos e faturas.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Placeholder for credit card list */}
          <div className="h-[400px] flex items-center justify-center bg-muted/50 rounded-md">
            <p className="text-muted-foreground">Lista de Cartões de Crédito em breve.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
