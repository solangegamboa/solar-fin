
'use client';

// Removed useEffect, useRouter, useAuth, Loader2 as auth is now mocked

import { AppHeader } from '@/components/core/AppHeader';
import { AppSidebar } from '@/components/core/AppSidebar';
import { SidebarProvider, SidebarInset, SidebarRail } from '@/components/ui/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // No more loading state or user check, assumes user is always the "default_user"
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
