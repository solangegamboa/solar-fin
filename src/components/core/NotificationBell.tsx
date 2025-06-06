
'use client';

import { Bell, CheckCheck, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { format, parseISO, isToday, isYesterday, formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { NotificationItem } from '@/types';

function formatNotificationDate(dateString: string): string {
  const date = parseISO(dateString);
  if (isToday(date)) {
    return `Hoje, ${format(date, 'HH:mm', { locale: ptBR })}`;
  }
  if (isYesterday(date)) {
    return `Ontem, ${format(date, 'HH:mm', { locale: ptBR })}`;
  }
  // For dates further than yesterday or in future, show relative or absolute
  const now = new Date();
  if (date > addDays(now, -7) && date < now ) { // within last 7 days
     return `${formatDistanceToNowStrict(date, { locale: ptBR, addSuffix: true })}`;
  }
  return format(date, 'dd/MM/yy HH:mm', { locale: ptBR });
}

// Helper function to add days, used in formatNotificationDate
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}


export function NotificationBell() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();

  if (isLoading) {
    return (
      <Button variant="ghost" size="icon" className="w-9 h-9" disabled>
        <Sun className="h-[1.2rem] w-[1.2rem] animate-spin" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative w-9 h-9">
          <Bell className="h-[1.2rem] w-[1.2rem]" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 text-xs flex items-center justify-center rounded-full"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Abrir notificações</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 md:w-96">
        <DropdownMenuLabel className="flex justify-between items-center">
          <span>Notificações</span>
          {notifications.length > 0 && unreadCount > 0 && (
             <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={(e) => { e.stopPropagation(); markAllAsRead();}}>
                <CheckCheck className="mr-1 h-3 w-3" /> Marcar todas como lidas
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <DropdownMenuItem disabled className="text-center text-muted-foreground py-4">
            Nenhuma notificação recente.
          </DropdownMenuItem>
        ) : (
          <ScrollArea className="h-[300px] md:h-[400px]">
            <DropdownMenuGroup>
            {notifications.map((notification: NotificationItem) => (
              <DropdownMenuItem
                key={notification.id}
                onSelect={(e) => { 
                    e.preventDefault(); // Prevent closing menu immediately
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
                <div className={cn("flex-grow space-y-0.5", notification.isRead && "pl-[18px]")}> {/* Add padding if dot is not there */}
                  <p className={cn("font-medium", !notification.isRead && "text-foreground")}>
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Data da transação: {format(parseISO(notification.date), 'dd/MM/yyyy', { locale: ptBR })}
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
