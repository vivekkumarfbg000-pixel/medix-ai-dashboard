import { useEffect, useState, useRef } from "react";
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
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { drugService } from "@/services/drugService";
import VoiceInput from "@/components/common/VoiceInput";
import { calculateTax, formatCurrency } from "@/utils/taxCalculator";
import { InvoiceTemplate } from "@/components/common/InvoiceTemplate";
import { createRoot } from "react-dom/client";

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  order_items: unknown;
  status: string;
  total_amount: number | null;
  tax_total: number | null;
  invoice_number: string | null;
  source: string;
  created_at: string;
}

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  price: number; // MRP (Inclusive)
  hsn_code?: string;
  sgst_rate: number;
  cgst_rate: number;
  igst_rate: number;
  schedule_h1?: boolean;
  substitute?: {
    name: string;
    price: number;
    savings: number;
    margin: number;
  };
}

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [activeTab, setActiveTab] = useState("whatsapp");

  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const handlePrintInvoice = async (order: Order) => {
    // Fetch shop details for the invoice header
    const { data: profile } = await supabase.from('profiles').select('shop_id').single();
    let shopDetails = undefined;

    if (profile?.shop_id) {
      const { data: shop } = await supabase.from('shops').select('*').eq('id', profile.shop_id).single();
      if (shop) shopDetails = shop;
    }

    // Create a hidden iframe or new window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Print Invoice</title>');
      // Inject styles - naive approach or link to main css
      printWindow.document.write('<style>body { font-family: sans-serif; } table { width: 100%; border-collapse: collapse; } th, td { padding: 8px; text-align: left; } .text-right { text-align: right; } .text-center { text-align: center; } .font-bold { font-weight: bold; } .border-b { border-bottom: 1px solid #ddd; } .text-sm { font-size: 0.875rem; } .text-xs { font-size: 0.75rem; } .flex { display: flex; } .justify-between { justify-content: space-between; } .mb-6 { margin-bottom: 1.5rem; } .p-8 { padding: 2rem; }</style>');
      printWindow.document.write('</head><body><div id="print-root"></div></body></html>');

      const root = createRoot(printWindow.document.getElementById('print-root')!);
      root.render(<InvoiceTemplate order={order} shopDetails={shopDetails} />);

      // Allow time for render
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load orders");
      console.error(error);
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            toast.info("New WhatsApp Order Received! 🔔");
            fetchOrders();
          } else {
            fetchOrders();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // --- POS FUNCTIONS ---

  const handleVoiceInput = (text: string) => {
    const cleanText = text.replace(/add/i, "").replace(/medicine/i, "").trim();
    if (cleanText) {
      setSearchQuery(cleanText);
      setTimeout(() => {
        handleAddItemWithQuery(cleanText);
      }, 500);
    }
  };

  const handleAddItemWithQuery = async (query: string) => {
    if (!query) return;

    // 1. Try Local Inventory First (for accurate price & tax)
    const { data: localItem } = await supabase
      .from("medicines")
      // @ts-ignore
      .select("*")
      .ilike('name', `%${query}%`)
      .limit(1)
      .single();

    let name = query;
    let price = 0;
    let hsn_code = "";
    let sgst_rate = 0;
    let cgst_rate = 0;
    let igst_rate = 0;

    let foundSub = null;

    if (localItem && localItem.quantity && localItem.quantity > 0) {
      name = localItem.name;
      // @ts-ignore
      price = localItem.mrp || localItem.unit_price || 0;
      // @ts-ignore
      hsn_code = localItem.hsn_code || "3004";
      // @ts-ignore
      sgst_rate = localItem.sgst_rate || 0;
      // @ts-ignore
      cgst_rate = localItem.cgst_rate || 0;
      // @ts-ignore
      igst_rate = localItem.igst_rate || 0;
      toast.success(`Found in Inventory: ${name}`);
    } else {
      // 2. Fallback to Global Knowledge Base
      const mockPrice = Math.floor(Math.random() * 200) + 50;
      price = mockPrice;
      // Default Tax for unknown items (Standard 12% GST assumed for demo or 0)
      sgst_rate = 6;
      cgst_rate = 6;

      const drugInfo = await drugService.searchDrug(query);
      if (drugInfo) {
        name = drugInfo.name; // Use canonical name
        if (drugInfo.substitutes && drugInfo.substitutes.length > 0) {
          const bestSub = drugInfo.substitutes.sort((a, b) => b.margin_percentage - a.margin_percentage)[0];
          if (bestSub.margin_percentage > 15) {
            foundSub = {
              name: bestSub.name,
              price: bestSub.price,
              savings: bestSub.savings,
              margin: bestSub.margin_percentage
            };
          }
        }
      }
    }

    const newItem: CartItem = {
      id: Date.now().toString(),
      name: name,
      price: price,
      quantity: 1,
      hsn_code,
      sgst_rate,
      cgst_rate,
      igst_rate,
      substitute: foundSub || undefined
    };

    setCart(prev => [...prev, newItem]);
    setSearchQuery("");

    if (foundSub) {
      toast("💡 Profit Opportunity Detected!", {
        description: `Switch ${newItem.name} to ${foundSub.name} to earn ${foundSub.margin}% margin!`,
        action: { label: "Switch Now", onClick: () => switchSubstitute(newItem.id, foundSub!) },
        duration: 8000,
      });
    } else if (!localItem) {
      toast.success(`External Added: ${name}`);
    }
  };

  const handleAddItem = async () => {
    await handleAddItemWithQuery(searchQuery);
  };

  const switchSubstitute = (itemId: string, sub: NonNullable<CartItem['substitute']>) => {
    setCart(cart.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          name: sub.name,
          price: sub.price,
          substitute: undefined
        };
      }
      return item;
    }));
    toast.success(`Switched to ${sub.name}!`, {
      description: "Customer saves money, you earn more margin."
    });
  };

  const removeItem = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const calculateCartTotals = () => {
    let subtotal = 0;
    let totalTax = 0;

    cart.forEach(item => {
      const breakdown = calculateTax(item.price * item.quantity, item.sgst_rate, item.cgst_rate, item.igst_rate, true);
      subtotal += breakdown.taxableAmount; // Base amount
      totalTax += breakdown.totalTax;
    });

    // We display Total Payable (which is MRP sum usually for retail)
    // Total Payable = Subtotal + Tax
    const totalPayable = subtotal + totalTax;

    return {
      subtotal,
      totalTax,
      totalPayable
    };
  };

  const completeSale = async () => {
    if (cart.length === 0) return;

    const { data: profile } = await supabase.from('profiles').select('shop_id').single();
    if (!profile) return;

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const totals = calculateCartTotals();

    // Prepare items with snapshot of tax data
    const orderItems = cart.map(c => {
      const tax = calculateTax(c.price * c.quantity, c.sgst_rate, c.cgst_rate, c.igst_rate, true);
      return {
        name: c.name,
        qty: c.quantity,
        price: c.price,
        hsn: c.hsn_code,
        tax_breakdown: tax
      };
    });

    const { error } = await supabase.from('orders').insert({
      shop_id: profile.shop_id,
      customer_name: customerName || "Walk-in Customer",
      customer_phone: customerPhone || null,
      total_amount: totals.totalPayable,
      tax_total: totals.totalTax,
      invoice_number: invoiceNumber,
      status: 'approved',
      source: 'manual_pos',
      order_items: orderItems as any // Casting to satisfy Json type
    });

    if (error) {
      toast.error("Failed to complete sale");
      console.error(error);
    } else {
      toast.success(`Sale Completed! Invoice ${invoiceNumber} Generated.`);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setActiveTab("whatsapp");
    }
  };

  const totals = calculateCartTotals();

  const filteredOrders = orders.filter(order =>
    filter === "all" ? true : order.status === filter
  );

  const pendingCount = orders.filter(o => o.status === "pending").length;

  return (
    <div className="space-y-6 animate-fade-in">
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
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageSquare className="w-4 h-4" /> WhatsApp ({pendingCount})
          </TabsTrigger>
          <TabsTrigger value="pos" className="gap-2">
            <ShoppingCart className="w-4 h-4" /> New Sale (POS)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="space-y-4">
          <div className="flex gap-2 flex-wrap mb-4">
            {[
              { value: "all", label: "All" },
              { value: "pending", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" }
            ].map(tab => (
              <Button
                key={tab.value}
                variant={filter === tab.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(tab.value as any)}
              >
                {tab.label}
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
                      <div className="text-right">
                        <p className="text-xl font-bold">₹{order.total_amount?.toLocaleString() || '-'}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'PP p')}</p>
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
                  <VoiceInput onTranscript={handleVoiceInput} />
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
                            onClick={() => switchSubstitute(item.id, item.substitute!)}
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
                <Button className="w-full h-12 text-lg" disabled={cart.length === 0} onClick={completeSale}>
                  Complete & Invoice
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Orders;
