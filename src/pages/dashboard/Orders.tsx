import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  MessageSquare,
  Check,
  X,
  Clock,
  Phone,
  User,
  Package,
  RefreshCw,
  ShoppingCart,
  Plus,
  Trash2,
  TrendingUp,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { format } from "date-fns";
import { drugService } from "@/services/drugService";

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  order_items: unknown;
  status: string;
  total_amount: number | null;
  source: string;
  created_at: string;
}

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
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

  const updateOrderStatus = async (orderId: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to update order");
    } else {
      toast.success(`Order ${status}`);
      fetchOrders();
    }
  };

  // --- POS FUNCTIONS ---

  const handleAddItem = async () => {
    if (!searchQuery) return;

    // Simulate Price Lookup (In real app, fetch from Inventory DB)
    // Using mock for demo
    const mockPrice = Math.floor(Math.random() * 200) + 50;

    // Check for Substitutes (The Profit Engine)
    const drugInfo = await drugService.searchDrug(searchQuery);
    let foundSub = null;
    if (drugInfo?.substitutes && drugInfo.substitutes.length > 0) {
      // Find the best substitute (highest margin)
      // Sort by margin desc
      const bestSub = drugInfo.substitutes.sort((a, b) => b.margin_percentage - a.margin_percentage)[0];

      if (bestSub.margin_percentage > 15) { // Only nudge if margin is significant
        foundSub = {
          name: bestSub.name,
          price: bestSub.price,
          savings: bestSub.savings,
          margin: bestSub.margin_percentage
        };
      }
    }

    const newItem: CartItem = {
      id: Date.now().toString(),
      name: searchQuery,
      price: mockPrice,
      quantity: 1,
      substitute: foundSub || undefined
    };

    setCart([...cart, newItem]);
    setSearchQuery("");

    if (foundSub) {
      toast("💡 Profit Opportunity Detected!", {
        description: `Switch ${newItem.name} to ${foundSub.name} to earn ${foundSub.margin}% margin!`,
        action: {
          label: "Switch Now",
          onClick: () => switchSubstitute(newItem.id, foundSub!)
        },
        duration: 8000,
      });
    }
  };

  const switchSubstitute = (itemId: string, sub: NonNullable<CartItem['substitute']>) => {
    setCart(cart.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          name: sub.name, // Switch name
          price: sub.price, // Switch price
          substitute: undefined // Remove nudge
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

  const calculateTotal = () => {
    return cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  };

  const completeSale = async () => {
    if (cart.length === 0) return;

    const { data: profile } = await supabase.from('profiles').select('shop_id').single();
    if (!profile) return;

    const { error } = await supabase.from('orders').insert({
      shop_id: profile.shop_id,
      customer_name: customerName || "Walk-in Customer",
      customer_phone: customerPhone || null,
      total_amount: calculateTotal(),
      status: 'approved',
      source: 'manual_pos',
      order_items: cart.map(c => ({ name: c.name, qty: c.quantity, price: c.price }))
    });

    if (error) {
      toast.error("Failed to complete sale");
    } else {
      toast.success("Sale Completed! ✅");
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setActiveTab("whatsapp"); // Switch back to view it
    }
  };

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
          {/* Existing Order List UI ... */}
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
                        {/* Order Items */}
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
            {/* Left: Product Entry */}
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
                  <Button size="lg" onClick={handleAddItem} className="h-full">
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>

                <div className="mt-6 space-y-3">
                  {cart.map((item, idx) => (
                    <div key={item.id} className="p-4 rounded-lg border bg-background/50 flex items-center justify-between group animate-in slide-in-from-left-2">
                      <div>
                        <h4 className="font-medium">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">₹{item.price} x {item.quantity}</p>

                        {/* PROFIT NUDGE UI */}
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
                        <p className="font-bold">₹{item.price * item.quantity}</p>
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

            {/* Right: Checkout */}
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
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₹{calculateTotal()}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>₹{calculateTotal()}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full h-12 text-lg" disabled={cart.length === 0} onClick={completeSale}>
                  Complete Sale
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
