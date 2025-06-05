
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Landmark,
  CreditCard,
  Repeat,
  Sparkles,
  Settings,
} from 'lucide-react';
import Logo from './Logo';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { SheetTitle } from '@/components/ui/sheet';
import * as React from "react"; // Import React for useState and useEffect

const navItems = [
  { href: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transações', icon: Repeat },
  { href: '/loans', label: 'Empréstimos', icon: Landmark },
  { href: '/credit-cards', label: 'Cartões', icon: CreditCard },
  { href: '/insights', label: 'Insights IA', icon: Sparkles },
];

const secondaryNavItems = [
  { href: '/settings', label: 'Configurações', icon: Settings },
];


export function AppSidebar() {
  const pathname = usePathname();
  const { open, isMobile: contextIsMobile } = useSidebar(); // Renamed to avoid conflict
  const [clientIsMobile, setClientIsMobile] = React.useState(false);

  React.useEffect(() => {
    // Set the clientIsMobile state after the component has mounted,
    // ensuring contextIsMobile reflects the actual client environment.
    setClientIsMobile(contextIsMobile);
  }, [contextIsMobile]);

  const titleClassName = cn(
    "font-bold text-2xl font-headline whitespace-nowrap transition-opacity duration-300 ease-in-out",
    // For desktop, apply opacity transition based on 'open' state
    // For mobile (clientIsMobile is true), this part of the logic won't apply opacity-0
    (!clientIsMobile && !open) ? "opacity-0 pointer-events-none" : "opacity-100"
  );

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Logo className={cn("transition-all duration-300 ease-in-out", open ? "h-10 w-10" : "h-8 w-8")} />
          {clientIsMobile ? (
            <SheetTitle className={titleClassName}>
              Solar Fin
            </SheetTitle>
          ) : (
            <div className={titleClassName}>
              Solar Fin
            </div>
          )}
        </Link>
      </SidebarHeader>
      
      <SidebarContent className="flex-grow p-2">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} passHref legacyBehavior>
                <SidebarMenuButton
                  isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
                  tooltip={open ? undefined : item.label}
                  className="justify-start"
                >
                  <item.icon className="h-5 w-5" />
                  <span className={cn("truncate", !open && "sr-only")}>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-2">
         <SidebarMenu>
          {secondaryNavItems.map((item) => (
            <SidebarMenuItem key={item.href}>
               <Link href={item.href} passHref legacyBehavior>
                <SidebarMenuButton
                  isActive={pathname.startsWith(item.href)}
                  tooltip={open ? undefined : item.label}
                  className="justify-start"
                >
                  <item.icon className="h-5 w-5" />
                  <span className={cn("truncate", !open && "sr-only")}>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
