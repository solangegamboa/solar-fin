
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react'; // Keep loader for visual consistency during quick redirect

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // No auth check needed, redirect directly to dashboard
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="ml-4 text-lg">Carregando Solar Fin...</p>
    </div>
  );
}
