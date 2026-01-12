import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Check,
  X,
  Edit2,
  Phone,
  FileText,
  Loader2,
  Trash2,
  Plus,
  Package
} from "lucide-react";
import { whatsappService } from "@/services/whatsappService";
import type { ParsedItem } from "./VoiceCommandBar";

interface ReviewInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcription: string;
  parsedItems: ParsedItem[];
  shopId: string | undefined;
}

interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  inventoryId?: string;
}

export function ReviewInvoiceModal({
  open,
  onOpenChange,
  transcription,
  parsedItems,
  shopId
}: ReviewInvoiceModalProps) {
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMatching, setIsMatching] = useState(false); // Default to false to avoid initial hang
  const [paymentMode, setPaymentMode] = useState<string>("cash");

  useEffect(() => {
    if (open && parsedItems.length > 0) {
      matchWithInventory();
    }
  }, [open, parsedItems]);

  const matchWithInventory = async () => {
    if (!shopId) {
      console.warn("No Shop ID found for matching inventory");
      // Fallback: Just show items as unmatched
      setItems(parsedItems.map((item, i) => ({
        id: `temp-${i}`,
        name: item.name,
        quantity: item.quantity,
        price: 0
      })));
      setIsMatching(false);
      return;
    }

    setIsMatching(true);

    try {
      console.log("Matching items with inventory...", parsedItems);
      const { data: inventory } = await supabase
        .from("inventory")
        .select("id, medicine_name, unit_price, quantity")
        .eq("shop_id", shopId);

      if (!inventory) {
        setItems(parsedItems.map((item, i) => ({
          id: `temp-${i}`,
          name: item.name,
          quantity: item.quantity,
          price: 0
        })));
        return;
      }

      const matchedItems: InvoiceItem[] = parsedItems.map((item, i) => {
        // Find best match in inventory (case-insensitive partial match)
        // Improved Match: Trim spaces and be flexible
        const match = inventory.find(inv => {
          const invName = inv.medicine_name.toLowerCase().trim();
          const itemName = item.name.toLowerCase().trim();
          return invName.includes(itemName) || itemName.includes(invName);
        });

        return {
          id: `item-${i}`,
          name: match?.medicine_name || item.name,
          quantity: item.quantity,
          price: match?.unit_price || 0,
          inventoryId: match?.id
        };
      });

      setItems(matchedItems);

      // Extract contact from parsed items
      const contact = parsedItems.find(p => p.contact)?.contact;
      if (contact) {
        setCustomerPhone(contact);
      }
    } catch (error) {
      console.error("Error matching inventory:", error);
    } finally {
      setIsMatching(false);
    }
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      id: `new-${Date.now()}`,
      name: "",
      quantity: 1,
      price: 0
    }]);
  };

  const handleSendWhatsApp = () => {
    if (!customerPhone) {
      toast.error("Please enter a customer phone number first");
      return;
    }
    const link = whatsappService.generateInvoiceLink(customerPhone, {
      customer_name: customerName || "Customer",
      created_at: new Date().toISOString(),
      total_amount: total,
      status: "DRAFT",
      items: items.map(i => ({ name: i.name, qty: i.quantity, price: i.price }))
    });
    window.open(link, '_blank');
  };

  const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  const handleConfirm = async () => {
    if (!shopId) {
      toast.error("No shop selected");
      return;
    }

    if (items.length === 0) {
      toast.error("Add at least one item");
      return;
    }

    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Create sale record
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          shop_id: shopId,
          customer_name: customerName,
          quantity_sold: items.reduce((sum, item) => sum + item.quantity, 0),
          total_amount: total,
          sale_date: new Date().toISOString(),
          payment_mode: paymentMode,
          payment_status: paymentMode === "credit" ? "pending" : "paid"
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // 2. Update inventory quantities
      for (const item of items) {
        if (item.inventoryId) {
          // Get current quantity and update
          const { data: current } = await supabase
            .from("inventory")
            .select("quantity")
            .eq("id", item.inventoryId)
            .single();

          if (current) {
            await supabase
              .from("inventory")
              .update({ quantity: Math.max(0, current.quantity - item.quantity) })
              .eq("id", item.inventoryId);
          }
        }
      }

      // 3. Trigger invoice webhook (will work when n8n secret is configured)
      try {
        await supabase.functions.invoke("invoice-webhook", {
          body: {
            sale_id: sale.id,
            customer_name: customerName,
            customer_phone: customerPhone,
            items: items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
            total,
            payment_mode: paymentMode,
            shop_name: "Medical Shop" // Would come from shop data
          }
        });
      } catch (webhookError) {
        console.log("Invoice webhook not configured yet:", webhookError);
      }

      toast.success("Sale confirmed! Invoice generated.");
      onOpenChange(false);
    } catch (error) {
      console.error("Error processing sale:", error);
      toast.error("Failed to process sale");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Review Invoice
          </DialogTitle>
          <DialogDescription>
            Verify the items and prices before confirming the sale.
          </DialogDescription>
        </DialogHeader>

        {/* Transcription Preview */}
        <div className="glass-card p-3 rounded-lg">
          <Label className="text-xs text-muted-foreground">Voice Transcription</Label>
          <p className="text-sm text-foreground mt-1">"{transcription}"</p>
        </div>

        {/* Customer Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer Name *</Label>
            <Input
              id="customerName"
              placeholder="Enter name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerPhone" className="flex items-center gap-1">
              <Phone className="w-3 h-3" /> Phone (WhatsApp)
            </Label>
            <Input
              id="customerPhone"
              placeholder="9876543210"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>
        </div>

        {/* Payment Mode */}
        <div className="space-y-2">
          <Label>Payment Mode</Label>
          <div className="flex gap-2">
            {["cash", "upi", "card", "credit"].map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={paymentMode === mode ? "default" : "outline"}
                onClick={() => setPaymentMode(mode)}
                className="flex-1 capitalize"
              >
                {mode === "credit" ? "Pay Later" : mode}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Items List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Items</Label>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4 mr-1" /> Add Item
            </Button>
          </div>

          {isMatching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Matching with inventory...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No items added yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={item.id} className="glass-card p-3 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-muted-foreground w-6">#{index + 1}</span>
                    <Input
                      placeholder="Medicine name"
                      value={item.name}
                      onChange={(e) => updateItem(item.id, "name", e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Price (₹)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.price}
                        onChange={(e) => updateItem(item.id, "price", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Subtotal</Label>
                      <div className="h-9 flex items-center font-medium">
                        ₹{(item.quantity * item.price).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  {item.inventoryId && (
                    <Badge variant="secondary" className="text-xs">
                      <Check className="w-3 h-3 mr-1" /> Matched with inventory
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Total */}
        <div className="flex items-center justify-between text-lg font-bold">
          <span>Total</span>
          <span className="text-primary">₹{total.toFixed(2)}</span>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-1" /> Cancel
          </Button>
          <Button variant="secondary" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleSendWhatsApp}>
            <Phone className="w-4 h-4 mr-1" /> WhatsApp
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing}>
            {isProcessing ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-1" />
            )}
            Confirm Sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
