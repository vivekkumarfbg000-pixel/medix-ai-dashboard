import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, ScanBarcode, MessageCircle, ArrowRight, User } from "lucide-react";

export const QuickActions = () => {
    const whatsappQueue = [
        { id: 1, name: "Ramesh Gupta", items: "3 items", time: "2m ago" },
        { id: 2, name: "Sneha Reddy", items: "1 prescription", time: "5m ago" },
    ];

    return (
        <Card className="h-full glass-card border-l-4 border-l-primary/50">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    ⚡ Quick Actions
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Daily Tools */}
                <div className="grid grid-cols-2 gap-3">
                    <Button className="h-20 flex flex-col gap-2 bg-gradient-to-br from-primary to-primary/80 hover:shadow-lg transition-all" onClick={() => { }}>
                        <Mic className="w-6 h-6" />
                        <span className="text-xs font-bold">New Sale</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col gap-2 border-primary/20 hover:bg-primary/5 hover:border-primary/50 transition-all" onClick={() => { }}>
                        <ScanBarcode className="w-6 h-6 text-primary" />
                        <span className="text-xs font-bold">Add Stock</span>
                    </Button>
                </div>

                {/* WhatsApp Queue */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-muted-foreground flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-green-500" /> WhatsApp Queue
                        </span>
                        <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold">LIVE</span>
                    </div>

                    <div className="space-y-2">
                        {whatsappQueue.map((order) => (
                            <div key={order.id} className="bg-white/50 p-2 rounded-lg border border-border/50 flex items-center justify-between group hover:border-green-400 transition-colors cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-sm">{order.name}</div>
                                        <div className="text-xs text-muted-foreground">{order.items} • {order.time}</div>
                                    </div>
                                </div>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50">
                                    <ArrowRight className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-primary">
                        View All Pending Orders
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
