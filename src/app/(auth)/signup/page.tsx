
'use client';

import Link from 'next/link';
import Logo from '@/components/core/Logo';

export default function SignupPage() {
   return (
    <div className="space-y-6 p-8 rounded-lg shadow-xl border bg-card text-center">
      <div className="flex flex-col items-center space-y-2">
        <Logo className="h-16 w-16" />
        <h1 className="text-2xl font-semibold tracking-tight font-headline">
          Acesso Simplificado
        </h1>
        <p className="text-sm text-muted-foreground">
          A funcionalidade de cadastro foi removida. A aplicação utiliza um usuário local padrão.
        </p>
      </div>
      <Link href="/dashboard">
        <button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md">
          Ir para o Painel
        </button>
      </Link>
      <p className="text-xs text-muted-foreground mt-4">
        As funcionalidades de login e cadastro foram desabilitadas.
      </p>
    </div>
  );
}
