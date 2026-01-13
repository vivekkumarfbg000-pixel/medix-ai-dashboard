import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export interface Customer {
    id: any; // Using any to handle string/number mismatch gracefully
    name: string;
    phone: string;
    credit_balance: number;
}

interface CustomerSearchProps {
    onSelect: (customer: Customer | null) => void;
    selectedCustomer: Customer | null;
}

export function CustomerSearch({ onSelect, selectedCustomer }: CustomerSearchProps) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState("");
    const [customers, setCustomers] = useState<Customer[]>([]);
    const { currentShop } = useUserShops();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });

    useEffect(() => {
        if (open && currentShop?.id) {
            fetchCustomers();
        }
    }, [open, currentShop]);

    const fetchCustomers = async () => {
        const { data } = await supabase
            .from("customers")
            .select("id, name, phone, credit_balance")
            .eq("shop_id", currentShop?.id)
            .limit(50);

        if (data) setCustomers(data);
    };

    const handleCreateCustomer = async () => {
        if (!newCustomer.name || !newCustomer.phone) {
            toast.error("Name and Phone required");
            return;
        }

        const { data, error } = await supabase.from("customers").insert({
            shop_id: currentShop?.id,
            name: newCustomer.name,
            phone: newCustomer.phone,
            credit_balance: 0
        }).select().single();

        if (error) {
            toast.error("Failed to create customer");
            console.error(error);
        } else if (data) {
            toast.success("Customer Created!");
            setCustomers([...customers, data]);
            onSelect(data); // Auto select
            setIsAddOpen(false);
            setOpen(false);
        }
    };

    return (
        <div className="flex gap-2 items-center">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-[250px] justify-between"
                    >
                        {selectedCustomer ? (
                            <div className="flex flex-col items-start leading-none gap-1">
                                <span className="font-bold">{selectedCustomer.name}</span>
                                <span className="text-[10px] text-muted-foreground">{selectedCustomer.phone}</span>
                            </div>
                        ) : (
                            "Select Customer for Credit..."
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0">
                    <Command>
                        <CommandInput placeholder="Search customer..." value={value} onValueChange={setValue} />
                        <CommandList>
                            <CommandEmpty>No customer found.</CommandEmpty>
                            <CommandGroup>
                                {customers.map((customer) => (
                                    <CommandItem
                                        key={customer.id}
                                        value={customer.name + " " + customer.phone}
                                        onSelect={() => {
                                            onSelect(customer);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="flex flex-col">
                                            <span>{customer.name}</span>
                                            <span className="text-xs text-muted-foreground">{customer.phone}</span>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                    <Button size="icon" variant="ghost"><Plus className="w-4 h-4" /></Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>New Customer</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-4">
                        <div className="space-y-1"><Label>Name</Label><Input value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} /></div>
                        <div className="space-y-1"><Label>Phone</Label><Input value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} /></div>
                        <Button className="w-full" onClick={handleCreateCustomer}>Create & Select</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
