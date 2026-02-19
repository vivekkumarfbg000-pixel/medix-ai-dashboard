import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Search, Eye, FileText, RefreshCw, Shield, CalendarIcon, X, Download, Filter, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUserShops } from "@/hooks/useUserShops";

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_value: any;
  new_value: any;
  user_id: string | null;
  created_at: string;
}

export default function AuditLogs({ embedded = false }: { embedded?: boolean }) {
  const { currentShop } = useUserShops();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (currentShop?.id) {
      fetchLogs();
    }
  }, [currentShop?.id]);

  async function fetchLogs() {
    if (!currentShop?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("shop_id", currentShop.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch audit logs: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      (log.table_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (log.record_id?.toLowerCase() || "").includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesTable = tableFilter === "all" || log.table_name === tableFilter;

    // Date range filter
    const logDate = new Date(log.created_at);
    let matchesDateRange = true;
    if (startDate && endDate) {
      matchesDateRange = isWithinInterval(logDate, {
        start: startOfDay(startDate),
        end: endOfDay(endDate),
      });
    } else if (startDate) {
      matchesDateRange = logDate >= startOfDay(startDate);
    } else if (endDate) {
      matchesDateRange = logDate <= endOfDay(endDate);
    }

    return matchesSearch && matchesAction && matchesTable && matchesDateRange;
  });

  const clearDateFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const uniqueTables = [...new Set(logs.map(log => log.table_name))];

  const handleExportCSV = () => {
    const headers = ["Timestamp", "Table", "Action", "Record ID", "User ID"];
    const rows = filteredLogs.map(log => [
      format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
      log.table_name,
      log.action,
      log.record_id,
      log.user_id || "System"
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_logs_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    toast.success("CSV exported successfully");
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "INSERT":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">INSERT</Badge>;
      case "UPDATE":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">UPDATE</Badge>;
      case "DELETE":
        return <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100">DELETE</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  return (
    <div className={`space-y-6 ${embedded ? 'p-0' : 'p-4'}`}>
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
              <Shield className="w-7 h-7 text-primary" />
              Audit Logs
            </h1>
            <p className="text-muted-foreground">Track all data changes for compliance</p>
          </div>
        </div>
      )}

      {embedded && (
        <div className="flex items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-semibold text-lg">System Audit Trail</h3>
              <p className="text-xs text-muted-foreground">Monitor modifications and deletions.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Sync
            </Button>
          </div>
        </div>
      )}

      <Card className={cn("border-none shadow-none bg-transparent", !embedded && "medical-card border shadow-sm bg-card")}>
        {!embedded && (
          <CardHeader>
            <CardTitle>Activity History</CardTitle>
            <CardDescription>
              Complete audit trail of all database modifications
            </CardDescription>
          </CardHeader>
        )}
        <CardContent className={cn("space-y-4", embedded && "p-0")}>
          {/* Filters */}
          <div className="flex flex-col gap-3 bg-card p-4 rounded-lg border shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
            </div>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by table or record ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full md:w-32 h-9">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="INSERT">INSERT</SelectItem>
                  <SelectItem value="UPDATE">UPDATE</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="w-full md:w-40 h-9">
                  <SelectValue placeholder="Table" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  {uniqueTables.map(table => (
                    <SelectItem key={table} value={table}>{table}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Filter */}
            {/* Simplified for embedded view clarity */}
            <div className="flex flex-wrap gap-2 items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-[140px] justify-start text-left font-normal h-9",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {startDate ? format(startDate, "MMM dd") : "Start Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-xs">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-[140px] justify-start text-left font-normal h-9",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {endDate ? format(endDate, "MMM dd") : "End Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {(startDate || endDate) && (
                <Button variant="ghost" size="sm" onClick={clearDateFilters} className="h-9">
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Record ID</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-muted-foreground">Loading audit logs...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="w-8 h-8 text-muted-foreground/50" />
                        <p className="text-muted-foreground font-medium">No audit logs found matching criteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "MMM dd, HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal text-xs">{log.table_name}</Badge>
                      </TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[120px]" title={log.record_id}>
                        {log.record_id}
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="w-4 h-4 text-primary" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                            <DialogHeader>
                              <DialogTitle>Audit Log Details</DialogTitle>
                              <DialogDescription>
                                {log.action} on {log.table_name} at{" "}
                                {format(new Date(log.created_at), "PPpp")}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4 text-sm bg-muted/40 p-3 rounded-lg border">
                                <div>
                                  <span className="font-medium text-muted-foreground">Record ID:</span>
                                  <p className="font-mono text-xs break-all mt-1 bg-white p-1 rounded border">{log.record_id}</p>
                                </div>
                                <div>
                                  <span className="font-medium text-muted-foreground">User ID:</span>
                                  <p className="font-mono text-xs break-all mt-1 bg-white p-1 rounded border">
                                    {log.user_id || "System"}
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {log.old_value && (
                                  <div className="space-y-1">
                                    <span className="font-medium text-sm text-destructive flex items-center gap-1">
                                      <X className="w-3 h-3" /> Old Value
                                    </span>
                                    <div className="mt-1 p-3 bg-red-50/50 border border-red-100 rounded-lg text-xs overflow-auto max-h-60 font-mono">
                                      <pre>{JSON.stringify(log.old_value, null, 2)}</pre>
                                    </div>
                                  </div>
                                )}

                                {log.new_value && (
                                  <div className="space-y-1">
                                    <span className="font-medium text-sm text-green-600 flex items-center gap-1">
                                      <Check className="w-3 h-3" /> New Value
                                    </span>
                                    <div className="mt-1 p-3 bg-green-50/50 border border-green-100 rounded-lg text-xs overflow-auto max-h-60 font-mono">
                                      <pre>{JSON.stringify(log.new_value, null, 2)}</pre>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-xs text-muted-foreground text-center pt-2">
            Showing latest {filteredLogs.length} activity logs
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
