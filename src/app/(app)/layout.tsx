
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { AppHeader } from '@/components/core/AppHeader';
import { AppSidebar } from '@/components/core/AppSidebar';
import { SidebarProvider, SidebarInset, SidebarRail } from '@/components/ui/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname !== '/login' && pathname !== '/signup') {
      router.replace('/login');
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Carregando sua sessão...</p>
      </div>
    );
  }

  if (!user) {
    // This condition should ideally be caught by the useEffect redirect,
    // but as a fallback, show a loader or minimal content.
    // Or, if the redirect is robust, this might not even be reached for app routes.
     return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Redirecionando...</p>
      </div>
    );
  }
  
  // User is authenticated and loaded
  return (
    <SidebarProvider defaultOpen={true}>
        <AppSidebar />
        <SidebarRail />
        <SidebarInset className="flex flex-col">
          <AppHeader />
          <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-background">
            {children}
          </main>
        </SidebarInset>
    </SidebarProvider>
  );
}
