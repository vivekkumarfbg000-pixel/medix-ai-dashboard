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
  FileText,
  Undo2
} from "lucide-react";
import { ReturnOrderModal } from "@/components/dashboard/orders/ReturnOrderModal";

// ... existing imports ...

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [activeTab, setActiveTab] = useState("whatsapp");

  // Return Modal State
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedOrderForReturn, setSelectedOrderForReturn] = useState<Order | null>(null);

  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  // ... existing POS state ...

  // ... existing functions ...

  const handleOpenReturn = (order: Order) => {
    setSelectedOrderForReturn(order);
    setReturnModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ... existing header ... */}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {/* ... existing tabs list ... */}

        <TabsContent value="whatsapp" className="space-y-4">
          {/* ... existing filter buttons ... */}

          {loading ? (
            // ... loading skeleton ...
            <div className="space-y-4">
              {[1, 2].map(i => <div key={i} className="h-24 bg-muted rounded animate-pulse" />)}
            </div>
          ) : filteredOrders.length === 0 ? (
            // ... empty state ...
            <Card><CardContent className="p-12 text-center text-muted-foreground">No orders found</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <Card key={order.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* ... existing order details ... */}
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

        {/* ... existing POS tab content ... */}
        <TabsContent value="pos">
          {/* ... existing POS content ... */}
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
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="w-full h-12 text-lg border-orange-200 text-orange-700 hover:bg-orange-50" disabled={cart.length === 0} onClick={() => completeSale(true)}>
                    📒 Pay Later
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
