import { usePresence } from "@/hooks/usePresence";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ActiveUsersProps {
  roomId: string;
}

export function ActiveUsers({ roomId }: ActiveUsersProps) {
  const { activeUsers } = usePresence(roomId);

  if (activeUsers.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-1">Now active:</span>
        <div className="flex -space-x-2">
          {activeUsers.slice(0, 5).map((user) => (
            <Tooltip key={user.id}>
              <TooltipTrigger asChild>
                <Avatar className={cn(
                  "w-7 h-7 border-2 border-background cursor-pointer",
                  "ring-2 ring-green-500 ring-offset-1 ring-offset-background"
                )}>
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {user.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm">
                  <p className="font-medium">{user.email}</p>
                  {user.editing && (
                    <p className="text-xs text-muted-foreground">
                      Editing: {user.editing}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
          {activeUsers.length > 5 && (
            <Avatar className="w-7 h-7 border-2 border-background">
              <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                +{activeUsers.length - 5}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
