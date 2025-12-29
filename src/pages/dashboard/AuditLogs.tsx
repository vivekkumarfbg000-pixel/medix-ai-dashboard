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
import { Search, Eye, FileText, RefreshCw, Shield, CalendarIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
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
      log.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.record_id.toLowerCase().includes(searchTerm.toLowerCase());
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

  const getActionBadge = (action: string) => {
    switch (action) {
      case "INSERT":
        return <Badge className="bg-green-500/10 text-green-600 border-green-200">INSERT</Badge>;
      case "UPDATE":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">UPDATE</Badge>;
      case "DELETE":
        return <Badge className="bg-red-500/10 text-red-600 border-red-200">DELETE</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground">Track all data changes for compliance</p>
        </div>
        <Button variant="outline" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="medical-card">
        <CardHeader>
          <CardTitle>Activity History</CardTitle>
          <CardDescription>
            Complete audit trail of all database modifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by table or record ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full sm:w-40">
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
                <SelectTrigger className="w-full sm:w-40">
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
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Date Range:</span>
              <div className="flex flex-wrap gap-2 items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[160px] justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "MMM dd, yyyy") : "Start date"}
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
                <span className="text-muted-foreground">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[160px] justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "MMM dd, yyyy") : "End date"}
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
                  <Button variant="ghost" size="sm" onClick={clearDateFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Timestamp</TableHead>
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
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Loading audit logs...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">No audit logs found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(log.created_at), "MMM dd, HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.table_name}</Badge>
                      </TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell className="font-mono text-xs truncate max-w-32">
                        {log.record_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="w-4 h-4" />
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
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="font-medium">Record ID:</span>
                                  <p className="font-mono text-xs break-all">{log.record_id}</p>
                                </div>
                                <div>
                                  <span className="font-medium">User ID:</span>
                                  <p className="font-mono text-xs break-all">
                                    {log.user_id || "System"}
                                  </p>
                                </div>
                              </div>

                              {log.old_value && (
                                <div>
                                  <span className="font-medium text-sm text-destructive">
                                    Old Value:
                                  </span>
                                  <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-auto max-h-40">
                                    {JSON.stringify(log.old_value, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {log.new_value && (
                                <div>
                                  <span className="font-medium text-sm text-green-600">
                                    New Value:
                                  </span>
                                  <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-auto max-h-40">
                                    {JSON.stringify(log.new_value, null, 2)}
                                  </pre>
                                </div>
                              )}
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

          <div className="text-sm text-muted-foreground text-center">
            Showing {filteredLogs.length} of {logs.length} logs
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
