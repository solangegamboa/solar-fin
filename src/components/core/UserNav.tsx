
'use client';

import { LogOut, User as UserIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast'; // Import useToast

export function UserNav() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast(); // Initialize useToast

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error: any) {
      console.error('Erro ao fazer logout:', error?.message || String(error));
      // Optionally, show a toast to the user
      toast({
        variant: 'destructive',
        title: 'Erro ao Sair',
        description: 'Não foi possível fazer logout. Tente novamente.',
      });
    }
  };

  if (!user) {
    return null;
  }

  const getInitials = (email?: string | null) => {
    if (!email) return 'SF'; // Solar Fin initials
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            {/* Placeholder for user image if available */}
            {/* <AvatarImage src="/avatars/01.png" alt={user.email || 'User'} /> */}
            <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.displayName || user.email}
            </p>
            {user.displayName && <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/settings')}>
            <UserIcon className="mr-2 h-4 w-4" />
            <span>Perfil</span>
            {/* <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut> */}
          </DropdownMenuItem>
          {/* Add other items like settings here */}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
          {/* <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut> */}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
