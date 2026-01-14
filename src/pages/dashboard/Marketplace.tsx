import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ShoppingCart, Filter, ArrowLeftRight, Package, Store, TrendingUp, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useUserShops } from "@/hooks/useUserShops";
import { format } from "date-fns";
import Purchases from "@/pages/dashboard/Purchases";
import Suppliers from "@/pages/dashboard/Suppliers";
// @ts-ignore
import { PurchaseReturnModal } from "@/components/dashboard/PurchaseReturnModal"; // Keep this if used, otherwise remove

// --- Marketplace Types ---
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

// Sample data since B2B tables don't exist yet
const sampleItems: CatalogItem[] = [
    { id: 1, drug_name: "Paracetamol 500mg", brand: "Crocin", price: 25, min_order_qty: 100, in_stock: true, distributor: { name: "Apollo Distributors" } },
    { id: 2, drug_name: "Azithromycin 500mg", brand: "Azee", price: 120, min_order_qty: 50, in_stock: true, distributor: { name: "MedPlus Wholesale" } },
    { id: 3, drug_name: "Omeprazole 20mg", brand: "Omez", price: 85, min_order_qty: 100, in_stock: true, distributor: { name: "Apollo Distributors" } },
    { id: 4, drug_name: "Metformin 500mg", brand: "Glycomet", price: 45, min_order_qty: 200, in_stock: true, distributor: { name: "Pharma Direct" } },
    { id: 5, drug_name: "Amoxicillin 500mg", brand: "Moxikind", price: 95, min_order_qty: 50, in_stock: true, distributor: { name: "HealthCare Needs" } },
    { id: 6, drug_name: "Pantoprazole 40mg", brand: "Pan40", price: 78, min_order_qty: 100, in_stock: false, distributor: { name: "Apollo Distributors" } },
];

const Marketplace = () => {
    const { currentShop } = useUserShops();
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("browse");
    const [isReturnOpen, setIsReturnOpen] = useState(false);

    // --- Marketplace Functions ---
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

    const placeOrder = async () => {
        toast.info("Connecting to Distributor Network...");
        setTimeout(() => {
            toast.success("Order Placed Successfully! (Simulation)");
            setCart([]);
        }, 1500);
    };

    const filteredItems = sampleItems.filter(i =>
        i.drug_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.brand.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Header Section */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-8 shadow-2xl">
                <div className="absolute right-0 top-0 h-48 w-48 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-blue-500/20 text-blue-200 hover:bg-blue-500/30 border-none">B2B Network</Badge>
                            <Badge className="bg-green-500/20 text-green-200 hover:bg-green-500/30 border-none">Live Prices</Badge>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Procurement Hub</h1>
                        <p className="text-blue-100/80 mt-2 max-w-xl">
                            One-stop solution for sourcing medicines, managing suppliers, and tracking purchase orders.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            className="bg-white/10 hover:bg-white/20 text-white border-none backdrop-blur-sm"
                            onClick={() => setIsReturnOpen(true)}
                        >
                            <ArrowLeftRight className="w-4 h-4 mr-2" /> Purchase Returns
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Content Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <div className="flex items-center justify-between border-b pb-1">
                    <TabsList className="bg-transparent h-auto p-0 gap-6">
                        <TabsTrigger
                            value="browse"
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-3 text-base text-muted-foreground data-[state=active]:text-foreground transition-all"
                        >
                            <Store className="w-4 h-4 mr-2" /> Marketplace
                        </TabsTrigger>
                        <TabsTrigger
                            value="purchases"
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-3 text-base text-muted-foreground data-[state=active]:text-foreground transition-all"
                        >
                            <Package className="w-4 h-4 mr-2" /> Purchase Orders
                        </TabsTrigger>
                        <TabsTrigger
                            value="suppliers"
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-3 text-base text-muted-foreground data-[state=active]:text-foreground transition-all"
                        >
                            <TrendingUp className="w-4 h-4 mr-2" /> My Suppliers
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* --- MARKETPLACE TAB --- */}
                <TabsContent value="browse" className="space-y-6 animate-in fade-in-50">
                    {/* Offers / Banner */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-200/50 p-4 rounded-xl flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold">%</div>
                            <div>
                                <h4 className="font-bold text-amber-900 dark:text-amber-100">Bulk Discount</h4>
                                <p className="text-xs text-amber-700 dark:text-amber-300">Get 5% off on orders above ₹10k</p>
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-200/50 p-4 rounded-xl flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold"><CheckCircle2 className="w-6 h-6" /></div>
                            <div>
                                <h4 className="font-bold text-emerald-900 dark:text-emerald-100">Verified Sellers</h4>
                                <p className="text-xs text-emerald-700 dark:text-emerald-300">100% Genuine Pharma Stockists</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 items-center">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search medicines, brands, or distributors..."
                                className="pl-10 h-11 bg-card shadow-sm border-gray-200"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" className="h-11 px-4"><Filter className="w-4 h-4 mr-2" /> Filters</Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredItems.map(item => (
                            <Card key={item.id} className="group hover:shadow-xl transition-all duration-300 border-gray-100 overflow-hidden">
                                <CardHeader className="pb-3 bg-muted/20">
                                    <div className="flex justify-between items-start">
                                        <Badge variant="secondary" className="bg-white shadow-sm font-normal text-xs">{item.distributor.name}</Badge>
                                        {item.in_stock ? (
                                            <span className="flex h-2 w-2 rounded-full bg-green-500" title="In Stock" />
                                        ) : (
                                            <span className="flex h-2 w-2 rounded-full bg-red-500" title="Out of Stock" />
                                        )}
                                    </div>
                                    <CardTitle className="mt-3 text-lg font-bold group-hover:text-primary transition-colors">{item.brand}</CardTitle>
                                    <CardDescription>{item.drug_name}</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <div className="flex justify-between items-end mb-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Price</p>
                                            <p className="text-xl font-bold text-slate-700 dark:text-slate-200">₹{item.price}<span className="text-sm font-normal text-muted-foreground">/unit</span></p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground">MOQ: <span className="font-medium text-foreground">{item.min_order_qty}</span></p>
                                        </div>
                                    </div>
                                    <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-md active:scale-95 transition-transform" onClick={() => addToCart(item)} disabled={!item.in_stock}>
                                        <ShoppingCart className="w-4 h-4 mr-2" /> {item.in_stock ? 'Add to Cart' : 'Notify Me'}
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* --- PURCHASES TAB (Consolidated) --- */}
                <TabsContent value="purchases" className="animate-in fade-in-50">
                    <Card className="border-none shadow-none bg-transparent">
                        <Purchases embedded={true} />
                    </Card>
                </TabsContent>

                {/* --- SUPPLIERS TAB (Consolidated) --- */}
                <TabsContent value="suppliers" className="animate-in fade-in-50">
                    <Card className="border-none shadow-none bg-transparent">
                        <Suppliers embedded={true} />
                    </Card>
                </TabsContent>
            </Tabs>

            {/* --- CART OVERLAY --- */}
            {cart.length > 0 && (
                <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
                    <Card className="w-80 shadow-2xl border-primary ring-2 ring-primary/20">
                        <CardHeader className="bg-primary text-primary-foreground py-3 rounded-t-xl">
                            <CardTitle className="text-sm font-medium flex justify-between items-center text-white">
                                <span>Bulk Cart ({cart.length})</span>
                                <span>₹{cart.reduce((a, c) => a + (c.price * c.orderQty), 0).toFixed(2)}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="max-h-60 overflow-y-auto pt-4 text-sm space-y-2 bg-background/95 backdrop-blur-sm">
                            {cart.map((c, i) => (
                                <div key={i} className="flex justify-between border-b pb-2 last:border-0">
                                    <span className="font-medium text-gray-700">{c.brand} <span className="text-xs text-muted-foreground">(x{c.orderQty})</span></span>
                                    <span className="font-bold">₹{c.price * c.orderQty}</span>
                                </div>
                            ))}
                        </CardContent>
                        <CardFooter className="pt-2 pb-3 bg-background/95 rounded-b-xl">
                            <Button className="w-full shadow-lg" onClick={placeOrder}>Confirm Order</Button>
                        </CardFooter>
                    </Card>
                </div>
            )}

            {/* Purchase Return Modal - Available globally in the section */}
            <PurchaseReturnModal
                open={isReturnOpen}
                onOpenChange={setIsReturnOpen}
                onSuccess={() => { }}
            />
        </div>
    );
};

export default Marketplace;
