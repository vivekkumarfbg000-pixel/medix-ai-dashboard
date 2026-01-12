import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  MessageSquare,
  User,
  RefreshCw,
  ShoppingCart,
  Plus,
  Trash2,
  TrendingUp,
  ArrowRight,
  FileText,
  Undo2,
  Share2,
  Search
} from "lucide-react";
import { ReturnOrderModal } from "@/components/dashboard/orders/ReturnOrderModal";
import { useUserShops } from "@/hooks/useUserShops";
import { format } from "date-fns";
import { VoiceCommandBar, ParsedItem } from "@/components/dashboard/VoiceCommandBar";
import { whatsappService } from "@/services/whatsappService";

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

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sgst_rate: number;
  cgst_rate: number;
  igst_rate: number;
  substitute?: {
    name: string;
    margin: number;
  };
}

const Orders = () => {
  const { currentShop } = useUserShops();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [activeTab, setActiveTab] = useState("whatsapp");

  // Return Modal State
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedOrderForReturn, setSelectedOrderForReturn] = useState<Order | null>(null);

  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  useEffect(() => {
    if (currentShop?.id) {
      fetchOrders();
    }
  }, [currentShop?.id]);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('shop_id', currentShop?.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error("Failed to load orders");
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  const filteredOrders = orders.filter(o =>
    filter === 'all' ? true : o.status === filter
  );

  const handleOpenReturn = (order: Order) => {
    setSelectedOrderForReturn(order);
    setReturnModalOpen(true);
  };

  const handlePrintInvoice = (order: Order) => {
    toast.info("Printing invoice...");
    // Implement actual print logic or window.print() view
  };

  const handleWhatsAppShare = (order: Order) => {
    if (!order.customer_phone) {
      toast.error("No phone number for this order");
      return;
    }
    const link = whatsappService.generateInvoiceLink(order.customer_phone, {
      invoice_number: order.invoice_number || 'INV-000',
      customer_name: order.customer_name,
      created_at: order.created_at,
      total_amount: order.total_amount,
      status: order.status,
      items: order.order_items
    });
    window.open(link, '_blank');
  };

  // --- POS FUNCTIONS ---

  const handleAddItem = async () => {
    if (!searchQuery.trim()) return;

    // Search in Inventory
    const { data, error } = await supabase
      .from('inventory')
      .select('id, medicine_name, unit_price')
      .eq('shop_id', currentShop?.id)
      .ilike('medicine_name', `${searchQuery}%`)
      .limit(1)
      .maybeSingle();

    if (data) {
      addToCart({
        id: data.id,
        name: data.medicine_name,
        price: data.unit_price,
        quantity: 1,
        sgst_rate: 6, // Default or fetch from DB
        cgst_rate: 6,
        igst_rate: 0
      });
      setSearchQuery("");
      toast.success(`Added ${data.medicine_name}`);
    } else {
      toast.error("Item not found");
    }
  };

  const addToCart = (item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      // Demo logic for substitute
      if (item.name.toLowerCase().includes("pan 40")) {
        item.substitute = { name: "Pantoprazole 40 (Generic)", margin: 45 };
      }
      return [...prev, item];
    });
  };

  const handleVoiceItems = (transcript: string, items: ParsedItem[]) => {
    toast.info(`Voice: ${transcript}`);
    // Simplified: Just add first match for demo
    setSearchQuery(items[0]?.name || transcript);
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const switchSubstitute = (id: string, sub: { name: string, margin: number }) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, name: sub.name, substitute: undefined } : i));
    toast.success("Switched to generic!");
  };

  const totals = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const totalTax = subtotal * 0.12; // Simplified 12% tax
    const totalPayable = subtotal + totalTax;
    return { subtotal, totalTax, totalPayable };
  }, [cart]);

  const formatCurrency = (val: number) => `₹${val.toFixed(2)}`;

  const completeSale = async (payLater: boolean) => {
    if (!currentShop?.id) return;

    setLoading(true);
    const invoiceNum = `INV-${Date.now().toString().slice(-6)}`;

    const { error } = await supabase.from('orders').insert({
      shop_id: currentShop.id,
      customer_name: customerName || "Walk-in",
      customer_phone: customerPhone,
      total_amount: totals.totalPayable,
      status: 'approved',
      source: 'web_pos',
      payment_mode: payLater ? 'credit' : 'cash',
      payment_status: payLater ? 'pending' : 'paid',
      invoice_number: invoiceNum,
      order_items: cart.map(c => ({
        name: c.name,
        qty: c.quantity,
        price: c.price,
        inventory_id: c.id
      }))
    });

    if (error) {
      toast.error("Order failed: " + error.message);
    } else {
      toast.success(payLater ? "Order saved to Khata" : "Sale Completed!");
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      fetchOrders();
    }
    setLoading(false);
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
                            <p className="text-sm text-muted-foreground">{order.source}</p>
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
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleWhatsAppShare(order)}>
                            <Share2 className="w-4 h-4 mr-1" /> Share
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

        <TabsContent value="pos">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-primary/20 bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle>Billing Counter</CardTitle>
                <CardDescription>Search and add medicines to cart</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Scan barcode or type medicine name..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                    className="text-lg py-6"
                  />
                  <VoiceCommandBar onTranscriptionComplete={handleVoiceItems} compact={true} />
                  <Button size="lg" onClick={handleAddItem} className="h-full">
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>

                <div className="mt-6 space-y-3">
                  {cart.map((item, idx) => (
                    <div key={item.id} className="p-4 rounded-lg border bg-background/50 flex items-center justify-between group animate-in slide-in-from-left-2">
                      <div>
                        <h4 className="font-medium">{item.name}</h4>
                        <div className="flex gap-2 text-sm text-muted-foreground mt-1">
                          <span>{formatCurrency(item.price)} x {item.quantity}</span>
                          <span className="text-xs border px-1 rounded bg-muted/50">GST: {item.sgst_rate + item.cgst_rate + item.igst_rate}%</span>
                        </div>

                        {item.substitute && (
                          <div
                            className="mt-2 flex items-center gap-2 p-2 bg-green-500/10 text-green-600 rounded-md border border-green-500/20 cursor-pointer hover:bg-green-500/20 transition-colors"
                            onClick={() => item.substitute && switchSubstitute(item.id, item.substitute)}
                          >
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-xs font-bold">
                              High Margin: Switch to {item.substitute.name} (+{item.substitute.margin}%)
                            </span>
                            <ArrowRight className="w-3 h-3 ml-auto opacity-50" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-bold">{formatCurrency(item.price * item.quantity)}</p>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {cart.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>Cart is empty</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="h-fit">
              <CardHeader className="bg-muted/50">
                <CardTitle>Checkout</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Customer Name</label>
                  <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="e.g. Rahul Kumar" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone Number</label>
                  <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="e.g. 9876543210" />
                </div>

                <div className="pt-4 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal (Pre-Tax)</span>
                    <span>{formatCurrency(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total GST</span>
                    <span>{formatCurrency(totals.totalTax)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Grand Total</span>
                    <span>{formatCurrency(totals.totalPayable)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    {cart.length} items • GST Compliant Invoice
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="w-full h-12 text-lg border-orange-200 text-orange-700 hover:bg-orange-50" disabled={cart.length === 0} onClick={() => completeSale(true)}>
                    📒 Khata
                  </Button>
                  <Button className="w-full h-12 text-lg" disabled={cart.length === 0} onClick={() => completeSale(false)}>
                    💵 Pay Now
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <ReturnOrderModal
        open={returnModalOpen}
        onOpenChange={setReturnModalOpen}
        order={selectedOrderForReturn}
        onSuccess={() => {
          fetchOrders();
        }}
      />
    </div>
  );
};

export default Orders;
