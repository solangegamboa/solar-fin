
'use client';

import { User as UserIcon, Settings, LogOut } from 'lucide-react'; // Added LogOut
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
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast'; // Keep for potential other uses, though logout toast is in AuthContext

export function UserNav() {
  const { user, logout, loading } = useAuth(); 
  const router = useRouter();
  // const { toast } = useToast(); // Logout toast now handled in AuthContext

  const handleLogout = async () => {
    await logout();
    // Redirect is handled in AuthContext or AppLayout
  };

  if (loading) {
     return (
      <Button variant="ghost" className="relative h-8 w-8 rounded-full">
        <Avatar className="h-8 w-8 animate-pulse bg-muted" />
      </Button>
    );
  }


  if (!user) {
    // This case should ideally be handled by route protection in AppLayout
    // For safety, can return a login button or null
    return (
        <Button onClick={() => router.push('/login')} variant="outline" size="sm">
            Login
        </Button>
    );
  }

  const getInitials = (email?: string | null, displayName?: string | null) => {
    if (displayName) {
      const nameParts = displayName.split(' ');
      if (nameParts.length > 1 && nameParts[0] && nameParts[nameParts.length -1]) {
        return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
      }
      return displayName.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'SF';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || user.email || 'User'} />}
            <AvatarFallback>{getInitials(user.email, user.displayName)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.displayName || 'Usuário'}
            </p>
            {user.email && <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/settings')}>
            <UserIcon className="mr-2 h-4 w-4" />
            <span>Perfil</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Configurações</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
