
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
  Target, // Added Target icon
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
import { SheetTitle } from '@/components/ui/sheet'; // Correctly SheetTitle from ui/sheet
import * as React from "react"; 

const navItems = [
  { href: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transações', icon: Repeat },
  { href: '/loans', label: 'Empréstimos', icon: Landmark },
  { href: '/credit-cards', label: 'Cartões', icon: CreditCard },
  { href: '/goals', label: 'Metas', icon: Target }, // Added Goals item
  { href: '/insights', label: 'Insights IA', icon: Sparkles },
];

const secondaryNavItems = [
  { href: '/settings', label: 'Configurações', icon: Settings },
];


export function AppSidebar() {
  const pathname = usePathname();
  // Directly use isMobile from the context. Removed local clientIsMobile state.
  const { open, isMobile, setOpenMobile } = useSidebar(); 

  const titleClassName = cn(
    "font-bold text-2xl font-headline whitespace-nowrap transition-opacity duration-300 ease-in-out",
    // Use `isMobile` from context directly here
    (!isMobile && !open) ? "opacity-0 pointer-events-none" : "opacity-100"
  );

  const handleMenuItemClick = () => {
    // Use `isMobile` from context directly here
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={handleMenuItemClick}>
          <Logo className={cn("transition-all duration-300 ease-in-out", open ? "h-10 w-10" : "h-8 w-8")} />
          {/* Use `isMobile` from context directly here */}
          {isMobile ? (
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
                  as="a" 
                  isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
                  tooltip={open ? undefined : item.label}
                  className="justify-start"
                  onClick={handleMenuItemClick}
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
                  as="a" 
                  isActive={pathname.startsWith(item.href)}
                  tooltip={open ? undefined : item.label}
                  className="justify-start"
                  onClick={handleMenuItemClick}
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
