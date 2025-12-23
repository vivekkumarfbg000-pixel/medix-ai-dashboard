import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  MessageSquare, 
  Check, 
  X, 
  Clock, 
  Phone,
  User,
  Package,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";

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

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

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
  }, []);

  const updateOrderStatus = async (orderId: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to update order");
      console.error(error);
    } else {
      toast.success(`Order ${status}`);
      fetchOrders();
    }
  };

  const filteredOrders = orders.filter(order => 
    filter === "all" ? true : order.status === filter
  );

  const pendingCount = orders.filter(o => o.status === "pending").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">WhatsApp Orders</h1>
          <p className="text-muted-foreground mt-1">
            Manage incoming orders from WhatsApp
          </p>
        </div>
        <Button variant="outline" onClick={fetchOrders}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: "all", label: "All Orders" },
          { value: "pending", label: `Pending (${pendingCount})` },
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

      {/* Orders List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-24 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No orders found</h3>
            <p className="text-muted-foreground">
              {filter === "all" 
                ? "Orders will appear here when received via WhatsApp"
                : `No ${filter} orders at the moment`
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Order Info */}
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{order.customer_name}</h3>
                        {order.customer_phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {order.customer_phone}
                          </p>
                        )}
                      </div>
                      <Badge 
                        className="ml-auto lg:hidden"
                        variant={
                          order.status === "pending" ? "secondary" :
                          order.status === "approved" ? "default" : "destructive"
                        }
                      >
                        {order.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {format(new Date(order.created_at), "MMM dd, yyyy HH:mm")}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        {order.source}
                      </span>
                      {order.total_amount && (
                        <span className="font-medium text-foreground">
                          ₹{order.total_amount.toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* Order Items Preview */}
                    {order.order_items && Array.isArray(order.order_items) && order.order_items.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {(order.order_items as any[]).slice(0, 3).map((item: any, idx: number) => (
                          <Badge key={idx} variant="outline" className="gap-1">
                            <Package className="w-3 h-3" />
                            {item.name || item}
                          </Badge>
                        ))}
                        {(order.order_items as any[]).length > 3 && (
                          <Badge variant="outline">
                            +{(order.order_items as any[]).length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center gap-3">
                    <Badge 
                      className="hidden lg:inline-flex"
                      variant={
                        order.status === "pending" ? "secondary" :
                        order.status === "approved" ? "default" : "destructive"
                      }
                    >
                      {order.status}
                    </Badge>

                    {order.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateOrderStatus(order.id, "approved")}
                          className="bg-success hover:bg-success/90"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateOrderStatus(order.id, "rejected")}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Orders;
