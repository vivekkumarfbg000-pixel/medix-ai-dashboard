import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Search, Package, AlertTriangle, Filter } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface InventoryItem {
  id: string;
  medicine_name: string;
  generic_name: string | null;
  batch_number: string | null;
  quantity: number;
  unit_price: number;
  cost_price: number | null;
  expiry_date: string | null;
  manufacturer: string | null;
  category: string | null;
  reorder_level: number;
}

const Inventory = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    medicine_name: "",
    generic_name: "",
    batch_number: "",
    quantity: 0,
    unit_price: 0,
    expiry_date: "",
    manufacturer: "",
    category: "",
  });

  const fetchInventory = async () => {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .order("medicine_name");

    if (error) {
      toast.error("Failed to load inventory");
      console.error(error);
    } else {
      setInventory(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return "safe";
    const days = differenceInDays(new Date(expiryDate), new Date());
    if (days < 0) return "expired";
    if (days <= 60) return "danger";
    if (days <= 90) return "warning";
    return "safe";
  };

  const handleAddItem = async () => {
    if (!newItem.medicine_name.trim()) {
      toast.error("Medicine name is required");
      return;
    }

    // First get user's shop_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("shop_id")
      .single();

    if (!profile?.shop_id) {
      toast.error("Unable to find your shop. Please try logging in again.");
      return;
    }

    const { error } = await supabase.from("inventory").insert({
      shop_id: profile.shop_id,
      medicine_name: newItem.medicine_name,
      generic_name: newItem.generic_name || null,
      batch_number: newItem.batch_number || null,
      quantity: newItem.quantity,
      unit_price: newItem.unit_price,
      expiry_date: newItem.expiry_date || null,
      manufacturer: newItem.manufacturer || null,
      category: newItem.category || null,
    });

    if (error) {
      toast.error("Failed to add item");
      console.error(error);
    } else {
      toast.success("Item added successfully");
      setIsAddDialogOpen(false);
      setNewItem({
        medicine_name: "",
        generic_name: "",
        batch_number: "",
        quantity: 0,
        unit_price: 0,
        expiry_date: "",
        manufacturer: "",
        category: "",
      });
      fetchInventory();
    }
  };

  const filteredInventory = inventory.filter(item =>
    item.medicine_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.generic_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage your medicine stock and track expiry dates
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Medicine
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Medicine</DialogTitle>
              <DialogDescription>
                Enter the details of the medicine to add to your inventory
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="medicine_name">Medicine Name *</Label>
                  <Input
                    id="medicine_name"
                    value={newItem.medicine_name}
                    onChange={(e) => setNewItem({ ...newItem, medicine_name: e.target.value })}
                    placeholder="e.g., Paracetamol 500mg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="generic_name">Generic Name</Label>
                  <Input
                    id="generic_name"
                    value={newItem.generic_name}
                    onChange={(e) => setNewItem({ ...newItem, generic_name: e.target.value })}
                    placeholder="e.g., Acetaminophen"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="batch_number">Batch Number</Label>
                  <Input
                    id="batch_number"
                    value={newItem.batch_number}
                    onChange={(e) => setNewItem({ ...newItem, batch_number: e.target.value })}
                    placeholder="e.g., BN123456"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input
                    id="manufacturer"
                    value={newItem.manufacturer}
                    onChange={(e) => setNewItem({ ...newItem, manufacturer: e.target.value })}
                    placeholder="e.g., Cipla"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit_price">Unit Price (₹) *</Label>
                  <Input
                    id="unit_price"
                    type="number"
                    step="0.01"
                    value={newItem.unit_price}
                    onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    placeholder="e.g., Tablets"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiry_date">Expiry Date</Label>
                <Input
                  id="expiry_date"
                  type="date"
                  value={newItem.expiry_date}
                  onChange={(e) => setNewItem({ ...newItem, expiry_date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddItem}>Add Medicine</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by medicine name, generic name, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Medicine Stock
          </CardTitle>
          <CardDescription>
            {filteredInventory.length} items in inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No medicines found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? "Try adjusting your search" : "Start by adding your first medicine"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Medicine
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine Name</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-center">Quantity</TableHead>
                    <TableHead className="text-right">Price (₹)</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.map((item) => {
                    const status = getExpiryStatus(item.expiry_date);
                    const days = item.expiry_date 
                      ? differenceInDays(new Date(item.expiry_date), new Date())
                      : null;
                    
                    return (
                      <TableRow 
                        key={item.id}
                        className={status === "danger" || status === "expired" ? "bg-destructive/5" : ""}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.medicine_name}</p>
                            {item.generic_name && (
                              <p className="text-sm text-muted-foreground">{item.generic_name}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.batch_number || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={item.quantity < (item.reorder_level || 10) ? "destructive" : "secondary"}
                          >
                            {item.quantity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₹{item.unit_price.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {item.expiry_date ? format(new Date(item.expiry_date), "MMM dd, yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          {status === "expired" && (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Expired
                            </Badge>
                          )}
                          {status === "danger" && (
                            <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {days} days
                            </Badge>
                          )}
                          {status === "warning" && (
                            <Badge className="bg-warning/20 text-warning border-warning/30">
                              {days} days
                            </Badge>
                          )}
                          {status === "safe" && item.expiry_date && (
                            <Badge variant="outline" className="text-success border-success/30">
                              Safe
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Inventory;
