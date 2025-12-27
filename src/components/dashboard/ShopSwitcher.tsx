import { Building2, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useUserShops } from "@/hooks/useUserShops";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export function ShopSwitcher() {
  const { shops, currentShop, loading, switchShop } = useUserShops();

  if (loading) {
    return (
      <div className="h-9 w-40 bg-muted animate-pulse rounded-md" />
    );
  }

  if (shops.length <= 1) {
    return (
      <Link to="/dashboard/settings" className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md hover:bg-muted transition-colors cursor-pointer">
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium truncate max-w-32">
          {currentShop?.name || "My Shop"}
        </span>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 h-9 px-3">
          <Building2 className="w-4 h-4" />
          <span className="truncate max-w-32">{currentShop?.name || "Select Shop"}</span>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <span>Switch Branch</span>
          <Badge variant="secondary" className="text-xs">
            {shops.length} locations
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {shops.map((shop) => (
          <DropdownMenuItem
            key={shop.id}
            onClick={() => switchShop(shop.id)}
            className={cn(
              "flex items-center justify-between cursor-pointer",
              shop.id === currentShop?.id && "bg-primary/10"
            )}
          >
            <div className="flex flex-col">
              <span className="font-medium">{shop.name}</span>
              {shop.address && (
                <span className="text-xs text-muted-foreground truncate max-w-44">
                  {shop.address}
                </span>
              )}
            </div>
            {shop.id === currentShop?.id && (
              <Check className="w-4 h-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
