import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";

export default function LoansPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Empréstimos</h1>
          <p className="text-muted-foreground">
            Acompanhe seus empréstimos e pagamentos.
          </p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Novo Empréstimo
        </Button>
      </div>

       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Seus Empréstimos</CardTitle>
          <CardDescription>Detalhes e progresso dos seus empréstimos ativos.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Placeholder for loans list */}
          <div className="h-[400px] flex items-center justify-center bg-muted/50 rounded-md">
            <p className="text-muted-foreground">Lista de Empréstimos em breve.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
