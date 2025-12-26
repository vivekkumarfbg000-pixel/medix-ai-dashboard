import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, ScanBarcode, MessageCircle, ArrowRight, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const QuickActions = () => {
    const navigate = useNavigate();
    const whatsappQueue = [
        { id: 1, name: "Ramesh Gupta", items: "3 items", time: "2m ago" },
        { id: 2, name: "Sneha Reddy", items: "1 prescription", time: "5m ago" },
    ];

    return (
        <Card className="h-full border-none shadow-none bg-transparent">
            <CardHeader className="pb-2 px-0">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                    ⚡ Quick Actions
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 px-0">
                {/* Daily Tools */}
                <div className="grid grid-cols-2 gap-4 relative z-50">
                    <Button
                        className="h-24 flex flex-col gap-2 bg-[#0284c7] hover:bg-[#0369a1] text-white border-none shadow-lg hover:shadow-xl transition-all rounded-xl active:scale-95 cursor-pointer"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log("Navigating to Orders");
                            navigate("/dashboard/orders");
                        }}
                    >
                        <Mic className="w-8 h-8" />
                        <span className="text-sm font-bold">New Sale</span>
                    </Button>
                    <Button
                        className="h-24 flex flex-col gap-2 bg-[#0f172a] hover:bg-[#1e293b] text-white border border-slate-700 shadow-lg hover:shadow-xl transition-all rounded-xl active:scale-95 cursor-pointer"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log("Navigating to Inventory");
                            navigate("/dashboard/inventory");
                        }}
                    >
                        <ScanBarcode className="w-8 h-8 text-[#0ea5e9]" />
                        <span className="text-sm font-bold">Add Stock</span>
                    </Button>
                </div>

                {/* WhatsApp Queue */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-white/90 flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-green-500" /> WhatsApp Queue
                        </span>
                        <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded-full font-bold">LIVE</span>
                    </div>

                    <div className="space-y-2">
                        {whatsappQueue.map((order) => (
                            <div key={order.id} className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-3 rounded-xl border border-slate-700/50 flex items-center justify-between group hover:border-[#0ea5e9]/50 transition-colors cursor-pointer shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#0ea5e9]/20 flex items-center justify-center text-[#38bdf8]">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-white">{order.name}</div>
                                        <div className="text-xs text-white opacity-90">{order.items} • {order.time}</div>
                                    </div>
                                </div>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:text-[#0ea5e9] hover:bg-transparent">
                                    <ArrowRight className="w-5 h-5" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <Button variant="ghost" size="sm" className="w-full text-xs text-white/70 hover:text-[#0ea5e9]">
                        View All Pending Orders
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
