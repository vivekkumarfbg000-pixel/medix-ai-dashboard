import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  MessageSquare,
  User,
  RefreshCw,
  ShoppingCart,
  FileText,
  Undo2,
  Share2,
  ArrowRight,
  Search,
  Pen
} from "lucide-react";
import { ReturnOrderModal } from "@/components/dashboard/orders/ReturnOrderModal";
import { useUserShops } from "@/hooks/useUserShops";
import { format } from "date-fns";
import { safeJSONParse } from "@/utils/jsonHelpers";
import { whatsappService } from "@/services/whatsappService";
import { useNavigate } from "react-router-dom";

interface OrderItem {
  name: string;
  qty: number;
  price: number;
  inventory_id: string;
}

interface Order {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone?: string;
  total_amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'returned';
  source: string;
  order_items: OrderItem[];
  invoice_number?: string;
}

const Orders = () => {
  const { currentShop } = useUserShops();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [activeTab, setActiveTab] = useState("whatsapp");

  // Return Modal State
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedOrderForReturn, setSelectedOrderForReturn] = useState<Order | null>(null);

  // Edit Phone State
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [newPhone, setNewPhone] = useState("");

  const updateCustomerPhone = async () => {
    if (!editingOrder || !newPhone) return;

    // Auto-prefix 91 if length is 10
    let finalPhone = newPhone.replace(/\D/g, '');
    if (finalPhone.length === 10) finalPhone = `91${finalPhone}`;

    const { error } = await supabase
      .from('orders')
      .update({ customer_phone: finalPhone })
      .eq('id', editingOrder.id);

    if (error) {
      toast.error("Failed to update phone number");
    } else {
      toast.success("Phone updated!");

      // Update local state immediately
      setOrders(prev => prev.map(o =>
        o.id === editingOrder.id ? { ...o, customer_phone: finalPhone } : o
      ));

      // Auto-trigger WhatsApp after successful update
      const updatedOrder = { ...editingOrder, customer_phone: finalPhone };
      setEditingOrder(null);

      // Small delay to allow dialog to close
      setTimeout(() => {
        handleWhatsAppShare(updatedOrder);
      }, 300);
    }
  };

  useEffect(() => {
    const backupId = localStorage.getItem("currentShopId");
    const activeId = currentShop?.id || backupId;

    if (activeId) {
      fetchOrders(activeId);

      // Real-time subscription to automatically refresh when orders change
      const channel = supabase
        .channel(`orders-realtime-${activeId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `shop_id=eq.${activeId}`
          },
          (payload) => {
            console.log('Order change detected:', payload);
            // Refresh orders when INSERT, UPDATE, or DELETE occurs
            fetchOrders(activeId);
            toast.info('Orders updated', { duration: 2000 });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentShop?.id, fetchOrders]);

  const fetchOrders = useCallback(async (shopId?: string | object) => {
    // FIX: Handle both direct string call and Event object from click
    const idToUse = typeof shopId === 'string' ? shopId : currentShop?.id;
    if (!idToUse) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('shop_id', idToUse)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Orders Load Error:", error);
      toast.error("Failed to load orders");
    } else {
      // Safe Parsing for JSONB columns which might be returned as strings
      const parsedData = (data || []).map((order: any) => {
        let items = order.order_items;
        if (typeof items === 'string') {
          items = safeJSONParse(items, []);
        }
        return { ...order, order_items: items };
      });
      setOrders(parsedData as Order[]);
    }
    setLoading(false);
  }, [currentShop?.id]);

  const filteredOrders = orders.filter(o =>
    filter === 'all' ? true : o.status === filter
  );

  const handleOpenReturn = (order: Order) => {
    setSelectedOrderForReturn(order);
    setReturnModalOpen(true);
  };

  const handlePrintInvoice = (order: Order) => {
    // Build a printable invoice and use window.print()
    const items = Array.isArray(order.order_items) ? order.order_items : [];
    const itemRows = items.map((item: any, idx: number) =>
      `<tr><td>${idx + 1}</td><td>${item.name}</td><td>${item.qty || 1}</td><td>₹${(item.price || 0).toFixed(2)}</td><td>₹${((item.price || 0) * (item.qty || 1)).toFixed(2)}</td></tr>`
    ).join('');

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      toast.error("Popup blocked. Please allow popups to print invoices.");
      return;
    }
    printWindow.document.write(`
      <html><head><title>Invoice #${order.invoice_number || 'NA'}</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 20px; max-width: 400px; margin: auto; }
        h2 { text-align: center; margin-bottom: 4px; }
        .shop-info { text-align: center; font-size: 12px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border-bottom: 1px solid #eee; padding: 6px 4px; text-align: left; }
        th { background: #f9f9f9; font-weight: 600; }
        .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 12px; }
        .footer { text-align: center; font-size: 11px; color: #999; margin-top: 20px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h2>${currentShop?.name || 'Pharmacy'}</h2>
      <div class="shop-info">${currentShop?.address || ''}<br/>${currentShop?.phone || ''}</div>
      <hr/>
      <p><strong>Invoice:</strong> #${order.invoice_number || 'NA'} &nbsp; <strong>Date:</strong> ${format(new Date(order.created_at), 'PP p')}</p>
      <p><strong>Patient:</strong> ${order.customer_name}</p>
      <table><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
      <tbody>${itemRows}</tbody></table>
      <div class="total">Grand Total: ₹${(order.total_amount || 0).toFixed(2)}</div>
      <div class="footer">Thank you for your trust!<br/>Powered by PharmaAssist.AI</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 300);
  };

  const handleWhatsAppShare = (order: Order) => {
    const phone = order.customer_phone;

    // If no phone, use the edit dialog instead of prompt
    if (!phone) {
      toast.error("Phone number missing. Please add customer contact first.");
      setEditingOrder(order);
      setNewPhone("");
      return;
    }

    // Generate link with full shop details
    const link = whatsappService.generateInvoiceLink(phone, {
      invoice_number: order.invoice_number || 'INV-000',
      customer_name: order.customer_name,
      created_at: order.created_at,
      total_amount: order.total_amount,
      status: order.status,
      items: order.order_items,
      shop_name: currentShop?.name || 'Pharmacy',
      shop_address: currentShop?.address || '',
      shop_phone: currentShop?.phone || '',
      shop_gstin: currentShop?.gst_no || '',
      payment_mode: 'cash'
    });

    // Try to open, with fallback
    const opened = window.open(link, '_blank');

    if (!opened || opened.closed || typeof opened.closed === 'undefined') {
      // Popup was blocked
      toast.error("Popup blocked! Click the button below to open WhatsApp", {
        duration: 10000,
        action: {
          label: "Open WhatsApp",
          onClick: () => {
            window.location.href = link; // Use location.href as fallback
          }
        }
      });
    } else {
      toast.success("WhatsApp invoice opened in new tab!");
    }
  };



  return (
    <div className="space-y-6 animate-fade-in p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Order Management</h1>
          <p className="text-muted-foreground mt-1">Manage sales and incoming orders</p>
        </div>
        <Button variant="outline" onClick={fetchOrders}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="whatsapp">Orders List</TabsTrigger>
          <TabsTrigger value="pos">New Sale (POS)</TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="space-y-4">
          {/* Filter Buttons */}
          <div className="flex gap-2 pb-2">
            {(["all", "pending", "approved", "rejected"] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f)}
                className="capitalize"
              >
                {f}
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => <div key={i} className="h-24 bg-muted rounded animate-pulse" />)}
            </div>
          ) : filteredOrders.length === 0 ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground">No orders found</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <Card key={order.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{order.customer_name}</h3>
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-muted-foreground">{order.customer_phone || "No Phone"}</p>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-primary"
                                onClick={() => {
                                  setEditingOrder(order);
                                  setNewPhone(order.customer_phone || "");
                                }}
                              >
                                <Pen className="w-3 h-3" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground/70">{order.source}</p>
                          </div>
                          <Badge variant={order.status === 'pending' ? 'secondary' : order.status === 'approved' ? 'default' : 'destructive'}>{order.status}</Badge>
                        </div>
                        {order.order_items && Array.isArray(order.order_items) && (
                          <div className="flex gap-2 flex-wrap">
                            {(order.order_items as any[]).map((item, idx) => (
                              <Badge key={idx} variant="outline">{item.name || item} {item.qty ? `x${item.qty}` : ''}</Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-right flex flex-col items-end gap-2">
                        <p className="text-xl font-bold">₹{order.total_amount?.toLocaleString() || '-'}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'PP p')}</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handlePrintInvoice(order)}>
                            <FileText className="w-4 h-4 mr-1" /> Print
                          </Button>
                          <Button size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => handleOpenReturn(order)}>
                            <Undo2 className="w-4 h-4 mr-1" /> Return
                          </Button>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1" onClick={() => handleWhatsAppShare(order)}>
                            <Share2 className="w-4 h-4" /> WhatsApp Invoice
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pos" className="h-[400px] flex flex-col items-center justify-center text-center space-y-6 border rounded-lg bg-muted/20 border-dashed">
          <div className="bg-primary/10 p-6 rounded-full">
            <ShoppingCart className="w-12 h-12 text-primary" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">Manage Billing in Billing Hub</h3>
            <p className="text-muted-foreground max-w-md mx-auto mt-2">
              We have moved the POS to a dedicated, high-speed terminal for faster checkout.
            </p>
          </div>
          <Button size="lg" className="gap-2" onClick={() => navigate('/dashboard/sales/pos')}>
            Go to Billing Hub <ArrowRight className="w-4 h-4" />
          </Button>
        </TabsContent>
      </Tabs>

      <ReturnOrderModal
        open={returnModalOpen}
        onOpenChange={setReturnModalOpen}
        order={selectedOrderForReturn}
        onSuccess={() => {
          if (currentShop?.id) fetchOrders(currentShop.id);
        }}
      />

      {/* Edit Contact Dialog */}
      <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Customer Contact</DialogTitle>
            <DialogDescription>Enter the correct WhatsApp number for {editingOrder?.customer_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                placeholder="e.g. 9876543210"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={updateCustomerPhone}>Update & Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;
