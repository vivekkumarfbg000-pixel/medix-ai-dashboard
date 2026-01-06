import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ShoppingCart, Truck, Package, Filter, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";
import { format } from "date-fns";


interface CatalogItem {
    id: number;
    drug_name: string;
    brand: string;
    price: number;
    min_order_qty: number;
    in_stock: boolean;
    distributor: {
        name: string;
    };
}

interface CartItem extends CatalogItem {
    orderQty: number;
}

const Marketplace = () => {
    const { currentShop } = useUserShops();
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("browse");

    useEffect(() => {
        fetchCatalogs();
    }, []);

    const fetchCatalogs = async () => {
        // Debug: Try simple query first without join
        const { data, error } = await supabase
            .from('catalogs' as any)
            .select(`
                *,
                distributor:distributors(name)
            `);

        if (error) {
            console.error("Supabase Error:", error);
            toast.error("Error: " + error.message);
            setItems([]);
        } else {
            console.log("Fetched Data:", data);
            if (!data || data.length === 0) {
                toast.warning("No catalogs found in database.");
            }
            // @ts-ignore
            setItems(data || []);
        }
        setLoading(false);
    };

    const addToCart = (item: CatalogItem) => {
        const existing = cart.find(c => c.id === item.id);
        if (existing) {
            setCart(cart.map(c => c.id === item.id ? { ...c, orderQty: c.orderQty + item.min_order_qty } : c));
            toast.success(`Updated Quantity for ${item.brand}`);
        } else {
            setCart([...cart, { ...item, orderQty: item.min_order_qty }]);
            toast.success(`Added ${item.brand} to B2B Cart`);
        }
    };

    const fetchOrders = async () => {
        if (!currentShop?.id) return;

        try {
            const { data, error } = await supabase
                .from('b2b_orders')
                .select('*')
                .eq('shop_id', currentShop.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error("Error fetching B2B orders:", error);
            setOrders([]);
        }
    };

    useEffect(() => {
        if (activeTab === "orders") fetchOrders();
    }, [activeTab, currentShop]);

    const placeOrder = async () => {
        if (!currentShop?.id) {
            toast.error("Shop ID missing. Please refresh.");
            return;
        }

        setLoading(true);
        try {
            // Group by Distributor
            const distributors = Array.from(new Set(cart.map(c => c.distributor.name)));

            for (const distName of distributors) {
                const distItems = cart.filter(c => c.distributor.name === distName);
                const total = distItems.reduce((a, c) => a + (c.price * c.orderQty), 0);

                // Insert into b2b_orders table
                const { error } = await supabase.from('b2b_orders').insert({
                    shop_id: currentShop.id,
                    distributor_name: distName,
                    items: distItems,
                    total_amount: total,
                    status: 'pending'
                });

                if (error) throw error;
            }

            toast.success("B2B Order(s) Placed Successfully!");
            setCart([]);
            setActiveTab("orders");
            fetchOrders();
        } catch (e: any) {
            console.error(e);
            toast.error("Failed to place order: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = items.filter(i =>
        i.drug_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.brand.toLowerCase().includes(searchQuery.toLowerCase())
    );





    return (
        <div className="space-y-6 animate-fade-in p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        B2B Marketplace ({items.length})
                    </h1>
                    <p className="text-muted-foreground mt-1">Connect with trusted distributors & restock instantly.</p>
                </div>
                <Button variant="outline" className="gap-2">
                    <Truck className="w-4 h-4" /> Manage Distributors
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="browse">Browse Catalogs</TabsTrigger>
                    <TabsTrigger value="orders">My Orders</TabsTrigger>
                </TabsList>

                <TabsContent value="browse" className="space-y-6">
                    <div className="flex gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search medicines, brands, or distributors..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="outline"><Filter className="w-4 h-4 mr-2" /> Filter</Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredItems.map(item => (
                            <Card key={item.id} className="hover:shadow-lg transition-all border-primary/10">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <Badge variant="outline" className="bg-primary/5">{item.distributor.name}</Badge>
                                        <Badge variant={item.in_stock ? "default" : "destructive"} className="text-[10px] h-5">
                                            {item.in_stock ? "In Stock" : "Helpers"}
                                        </Badge>
                                    </div>
                                    <CardTitle className="mt-2 text-xl">{item.brand}</CardTitle>
                                    <CardDescription>{item.drug_name}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex justify-between items-end mb-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Wholesale Price</p>
                                            <p className="text-lg font-bold">₹{item.price.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">/ unit</span></p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground">Min Qty</p>
                                            <p className="font-medium">{item.min_order_qty} Units</p>
                                        </div>
                                    </div>
                                    <Button className="w-full" onClick={() => addToCart(item)}>
                                        <ShoppingCart className="w-4 h-4 mr-2" /> Add to Order
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="orders">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent B2B Orders</CardTitle>
                            <CardDescription>Track your procurement status.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {orders.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No past orders found.</p>
                                    <Button variant="link" onClick={() => setActiveTab("browse")}>Start Browsing</Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {orders.map((order) => (
                                        <div key={order.id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-muted/50">
                                            <div>
                                                <p className="font-bold">{order.distributor_name}</p>
                                                <p className="text-sm text-muted-foreground">Placed on {format(new Date(order.created_at), "dd MMM yyyy, hh:mm a")}</p>
                                                <div className="text-xs mt-1 text-muted-foreground">
                                                    {Array.isArray(order.items) && order.items.map((i: any) => i.brand).join(", ")}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <Badge variant={order.status === 'pending' ? 'outline' : 'default'} className="mb-1">
                                                    {order.status.toUpperCase()}
                                                </Badge>
                                                <p className="font-bold">₹{order.total_amount.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Floating Cart for B2B */}
            {cart.length > 0 && (
                <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
                    <Card className="w-80 shadow-2xl border-primary">
                        <CardHeader className="bg-primary text-primary-foreground py-3">
                            <CardTitle className="text-sm font-medium flex justify-between items-center text-white">
                                <span>Bulk Cart ({cart.length})</span>
                                <span>₹{cart.reduce((a, c) => a + (c.price * c.orderQty), 0).toFixed(2)}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="max-h-60 overflow-y-auto pt-4 text-sm space-y-2">
                            {cart.map((c, i) => (
                                <div key={i} className="flex justify-between">
                                    <span>{c.brand} (x{c.orderQty})</span>
                                    <span>₹{c.price * c.orderQty}</span>
                                </div>
                            ))}
                        </CardContent>
                        <CardFooter className="pt-2 pb-3">
                            <Button className="w-full" onClick={placeOrder}>Confirm Order</Button>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default Marketplace;
