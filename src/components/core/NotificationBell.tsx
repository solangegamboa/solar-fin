
'use client';

import { Bell, CheckCheck, Sun, CalendarClock } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { NotificationItem } from '@/types';

function formatProjectedDate(dateString: string): string {
  const date = parseISO(dateString);
   if (isToday(date)) {
    return `Hoje, ${format(date, 'dd/MM', { locale: ptBR })}`;
  }
  if (isYesterday(date)) {
    return `Ontem, ${format(date, 'dd/MM', { locale: ptBR })}`;
  }
  return format(date, 'dd/MM/yyyy', { locale: ptBR });
}


export function NotificationBell() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, refreshNotifications } = useNotifications();

  const handleOpenChange = (open: boolean) => {
    if (open) {
      refreshNotifications();
    }
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative w-9 h-9"
          aria-label="Abrir notificações"
          disabled={isLoading && unreadCount === 0}
        >
          {isLoading && unreadCount === 0 ? (
            <Sun className="h-[1.2rem] w-[1.2rem] animate-spin" />
          ) : (
            <Bell className="h-[1.2rem] w-[1.2rem]" />
          )}
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 text-xs flex items-center justify-center rounded-full pointer-events-none"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Abrir notificações</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 md:w-96">
        <DropdownMenuLabel className="flex justify-between items-center">
          <span>Notificações Agendadas</span>
          {notifications.length > 0 && unreadCount > 0 && !isLoading && (
             <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={(e) => { e.stopPropagation(); markAllAsRead();}}>
                <CheckCheck className="mr-1 h-3 w-3" /> Marcar todas como lidas
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading && notifications.length === 0 ? (
          <DropdownMenuItem disabled className="flex justify-center items-center py-4">
            <Sun className="h-4 w-4 animate-spin mr-2" />
            Carregando...
          </DropdownMenuItem>
        ) : !isLoading && notifications.length === 0 ? (
          <DropdownMenuItem disabled className="text-center text-muted-foreground py-4">
            Nenhuma notificação agendada.
          </DropdownMenuItem>
        ) : (
          <ScrollArea className="h-[300px] md:h-[400px]">
            <DropdownMenuGroup>
            {isLoading && notifications.length > 0 && (
                 <DropdownMenuItem disabled className="flex justify-center items-center py-2 opacity-75">
                    <Sun className="h-3 w-3 animate-spin mr-1.5" />
                    Atualizando...
                </DropdownMenuItem>
            )}
            {notifications.map((notification: NotificationItem) => (
              <DropdownMenuItem
                key={notification.id}
                onSelect={(e) => {
                    e.preventDefault();
                    if (!notification.isRead) markAsRead(notification.id);
                }}
                className={cn(
                    "flex items-start gap-2.5 p-3 text-sm cursor-pointer focus:bg-accent focus:text-accent-foreground",
                    !notification.isRead && "bg-primary/5"
                )}
              >
                {!notification.isRead && (
                  <span className="mt-1 block h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
                <div className={cn("flex-grow space-y-0.5", notification.isRead && "pl-[18px]")}>
                  <div className="flex items-center justify-between">
                     <p className={cn("font-medium truncate", !notification.isRead && "text-foreground")} title={notification.message}>
                        {notification.message}
                     </p>
                     {notification.isPast && (
                        <Badge variant="outline" className="ml-2 text-xs px-1.5 py-0.5 border-yellow-500 text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/30">
                            Ocorrida
                        </Badge>
                     )}
                     {!notification.isPast && (
                        <Badge variant="default" className="ml-2 text-xs px-1.5 py-0.5 bg-blue-500 text-white">
                            Agendada
                        </Badge>
                     )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center">
                    <CalendarClock className="mr-1 h-3.5 w-3.5" />
                    Data Agendada: {formatProjectedDate(notification.projectedDate)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                     Original: {notification.originalTransaction.category} ({format(parseISO(notification.originalTransaction.date), 'dd/MM/yy', { locale: ptBR})})
                  </p>
                </div>
              </DropdownMenuItem>
            ))}
            </DropdownMenuGroup>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
