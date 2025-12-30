import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLiveQuery } from "dexie-react-hooks";
import { db, OfflineInventory } from "@/db/db";
import { toast } from "sonner";
import { ShoppingCart, RefreshCw, Mic, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import VoiceInput from "@/components/common/VoiceInput";

const LitePOS = () => {
    const [cart, setCart] = useState<{ item: OfflineInventory; qty: number }[]>([]);
    const [search, setSearch] = useState("");

    // Live Query from Local DB (Instant Search)
    const products = useLiveQuery(
        () => db.inventory
            .where("medicine_name")
            .startsWithIgnoreCase(search)
            .limit(10)
            .toArray(),
        [search]
    );

    const addToCart = (product: OfflineInventory) => {
        setCart((prev) => {
            const existing = prev.find((c) => c.item.id === product.id);
            if (existing) {
                return prev.map((c) => c.item.id === product.id ? { ...c, qty: c.qty + 1 } : c);
            }
            return [...prev, { item: product, qty: 1 }];
        });
        toast.success(`Added ${product.medicine_name}`);
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter((c) => c.item.id !== id));
    };

    const calculateTotal = () => cart.reduce((acc, curr) => acc + (curr.item.unit_price * curr.qty), 0);

    const handleVoiceData = (text: string) => {
        setSearch(text);
        // Simple logic: if text matches exactly one item, auto-add
        db.inventory.where("medicine_name").equalsIgnoreCase(text).first().then(item => {
            if (item) {
                addToCart(item);
                setSearch("");
            }
        });
    };

    return (
        <div className="h-screen flex flex-col bg-slate-50">
            {/* Header */}
            <div className="bg-primary p-4 flex items-center justify-between text-white shadow-md">
                <Link to="/dashboard" className="flex items-center gap-2 font-bold text-lg">
                    <ArrowLeft /> Back
                </Link>
                <h1 className="text-xl font-bold">Munim-ji Lite ⚡</h1>
                <div className="flex items-center gap-2">
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                        {navigator.onLine ? "🟢 Online" : "🔴 Offline Mode"}
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                {/* Left: Product Grid (Big Buttons) */}
                <div className="flex-1 p-4 overflow-y-auto">
                    <div className="mb-4 flex gap-2">
                        <Input
                            placeholder="Search..."
                            className="h-12 text-lg"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <VoiceInput onTranscript={handleVoiceData} className="h-12 w-12" />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {products?.map((prod) => (
                            <button
                                key={prod.id}
                                onClick={() => addToCart(prod)}
                                className="h-32 bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col items-center justify-center gap-2 hover:bg-blue-50 active:scale-95 transition-all"
                            >
                                <span className="font-bold text-lg text-center leading-tight line-clamp-2">{prod.medicine_name}</span>
                                <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-full font-mono">₹{prod.unit_price}</span>
                            </button>
                        ))}
                        {products?.length === 0 && (
                            <div className="col-span-full text-center py-10 text-muted-foreground">
                                No items found. Run "Sync" first.
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Cart (Mobile Bottom Sheet or Side Panel) */}
                <div className="md:w-96 bg-white shadow-xl border-l flex flex-col">
                    <div className="p-4 bg-slate-100 border-b">
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            <ShoppingCart /> Current Bill
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {cart.map((line) => (
                            <div key={line.item.id} className="flex justify-between items-center p-3 border rounded-lg bg-slate-50">
                                <div>
                                    <div className="font-medium">{line.item.medicine_name}</div>
                                    <div className="text-sm text-muted-foreground">
                                        ₹{line.item.unit_price} x {line.qty}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold">₹{line.item.unit_price * line.qty}</span>
                                    <Button variant="ghost" size="icon" onClick={() => removeFromCart(line.item.id)}>
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 border-t bg-slate-50 space-y-4">
                        <div className="flex justify-between text-xl font-bold">
                            <span>Total</span>
                            <span>₹{calculateTotal()}</span>
                        </div>
                        <Button size="lg" className="w-full h-14 text-xl font-bold bg-green-600 hover:bg-green-700">
                            Checkout & Cash (₹)
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LitePOS;
