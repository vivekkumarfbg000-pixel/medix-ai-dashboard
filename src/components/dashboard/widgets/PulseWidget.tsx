import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, AlertOctagon, Lightbulb, PackageX } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const PulseWidget = () => {
    const data = [
        { name: 'Mon', revenue: 4000 },
        { name: 'Tue', revenue: 3000 },
        { name: 'Wed', revenue: 2000 },
        { name: 'Thu', revenue: 2780 },
        { name: 'Fri', revenue: 1890 },
        { name: 'Sat', revenue: 2390 },
        { name: 'Today', revenue: 3490 },
    ];

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Revenue Graph */}
            <Card className="glass-card flex-1 min-h-[250px]">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-green-500" /> Revenue Pulse
                        </CardTitle>
                        <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
                            +12% vs Yesterday
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                formatter={(value) => [`₹${value}`, 'Revenue']}
                            />
                            <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Stock Health & AI Insight */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Stock Health */}
                <Card className="glass-card bg-red-50/50 border-red-100 dark:bg-slate-800 dark:border-red-900/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                            <AlertOctagon className="w-4 h-4" /> Critical Stock
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold text-red-600 dark:text-red-400">12</span>
                            <span className="text-xs text-red-600/80 dark:text-red-300/80 mb-1 font-medium">Items near zero</span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                            <PackageX className="w-3 h-3" /> Auto-reorder suggested
                        </div>
                    </CardContent>
                </Card>

                {/* AI Insight */}
                <Card className="glass-card bg-blue-50/50 border-blue-100 dark:bg-slate-800 dark:border-blue-900/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <Lightbulb className="w-12 h-12 text-blue-500" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-blue-700 dark:text-[#0ea5e9] flex items-center gap-2">
                            <Lightbulb className="w-4 h-4" /> AI Pro Tip
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm font-medium text-foreground leading-snug">
                            "Dengue cases rising in your area. Stock up on <span className="underline decoration-wavy decoration-[#0ea5e9]">Platelet Boosters</span> & <span className="underline decoration-wavy decoration-[#0ea5e9]">Paracetamol</span>."
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
