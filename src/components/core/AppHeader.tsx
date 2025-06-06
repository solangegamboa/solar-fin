import Link from 'next/link';
import Logo from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { UserNav } from './UserNav';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { NotificationBell } from './NotificationBell.tsx'; // Importa o NotificationBell

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0 px-4 md:px-8">
        <div className="flex items-center gap-2">
           <div className="md:hidden"> {/* Only show trigger on mobile, as sidebar is part of layout on desktop */}
            <SidebarTrigger />
          </div>
          <Link href="/dashboard" className="flex items-center space-x-2">
            <Logo className="h-8 w-8" />
            <span className="font-bold text-xl font-headline hidden sm:inline-block">
              Solar Fin
            </span>
          </Link>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-1">
            <ThemeToggle />
            <NotificationBell /> {/* Adiciona o NotificationBell aqui */}
            <UserNav />
          </nav>
        </div>
      </div>
    </header>
  );
}
