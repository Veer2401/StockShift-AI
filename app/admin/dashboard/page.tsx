"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Package,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Activity,
  Brain,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  PackageCheck,
  Loader2,
  Plus,
  Building2,
  MapPin,
  Tag,
  Boxes,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useInventory } from "@/_lib/inventory-context";
import { useAuth } from "@/_lib/auth-context";
import { formatCurrency, formatRelativeTime, cn } from "@/_lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/_components/ui/card";
import { Badge } from "@/_components/ui/badge";
import { Button } from "@/_components/ui/button";
import { Input } from "@/_components/ui/input";
import { Label } from "@/_components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/_components/ui/dialog";
import { getInsights, type InsightsResponse } from "@/_lib/ai-service";

const PIE_COLORS = [
  "hsl(142, 71%, 45%)",
  "hsl(217, 91%, 60%)",
  "hsl(38, 92%, 50%)",
  "hsl(340, 82%, 52%)",
  "hsl(262, 83%, 58%)",
  "hsl(0, 0%, 65%)",
];

const URGENCY_CONFIG = {
  critical: { color: "bg-red-100 text-red-700 border-red-200" },
  high: { color: "bg-orange-100 text-orange-700 border-orange-200" },
  medium: { color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  low: { color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const TYPE_ICON = {
  reorder: PackageCheck,
  anomaly: ShieldAlert,
  overstock: Package,
};

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { items: inventoryItems, transactions, addItem, isLoading: isInventoryLoading } = useInventory();

  /* Add Item Modal State */
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [quantity, setQuantity] = useState(10);
  const [unitCost, setUnitCost] = useState(100);
  const [sellPrice, setSellPrice] = useState(150);
  const [reorderPoint, setReorderPoint] = useState(5);
  const [location, setLocation] = useState(user?.city ? `${user.city} Warehouse` : "Main Warehouse");

  /* AI Insights state */
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const data = await getInsights();
      setInsights(data);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Failed to load AI insights");
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  // Real-time calculations based strictly on user inventory
  const totalItemsCount = useMemo(
    () => inventoryItems.reduce((sum, item) => sum + item.quantity, 0),
    [inventoryItems]
  );

  const totalCostValuation = useMemo(
    () =>
      inventoryItems.reduce(
        (sum, item) => sum + item.quantity * item.unitCost,
        0
      ),
    [inventoryItems]
  );

  const totalEstimatedRevenue = useMemo(
    () =>
      inventoryItems.reduce(
        (sum, item) => sum + item.quantity * item.sellPrice,
        0
      ),
    [inventoryItems]
  );

  const totalPotentialProfit = useMemo(
    () => Math.max(0, totalEstimatedRevenue - totalCostValuation),
    [totalEstimatedRevenue, totalCostValuation]
  );

  const lowStockItems = useMemo(
    () => inventoryItems.filter((item) => item.quantity <= item.reorderPoint),
    [inventoryItems]
  );

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    inventoryItems.forEach((item) => {
      const val = item.quantity * item.unitCost;
      map.set(item.category, (map.get(item.category) ?? 0) + val);
    });
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [inventoryItems]);

  // Handle Quick Add Item
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !sku) return;

    try {
      setIsSubmitting(true);
      await addItem({
        name,
        sku,
        category,
        quantity: Number(quantity),
        unitCost: Number(unitCost),
        sellPrice: Number(sellPrice),
        reorderPoint: Number(reorderPoint),
        location,
      });

      // reset form
      setName("");
      setSku("");
      setQuantity(10);
      setUnitCost(100);
      setSellPrice(150);
      setIsAddOpen(false);
    } catch (err: any) {
      alert(err?.message || "Failed to add item");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-xl font-bold text-foreground">
              {user?.companyName || "Your Business Workspace"}
            </h2>
          </div>
          {user?.city && user?.state && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
              <span>{user.city}, {user.state} (India)</span>
            </p>
          )}
        </div>
        <Button
          onClick={() => setIsAddOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md shadow-emerald-600/20"
        >
          <Plus className="h-4 w-4 mr-2" /> Add Inventory Item
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="border border-border/60 shadow-none">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="rounded-xl p-2.5 bg-emerald-50 text-emerald-600">
                <Boxes className="h-5 w-5" />
              </div>
              <Badge variant="secondary" className="border-0 bg-emerald-50 text-emerald-600 text-xs">
                Active
              </Badge>
            </div>
            <p className="mt-3 text-2xl font-bold text-foreground sm:mt-4">
              {totalItemsCount.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">Total Inventory Stock</p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-none">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="rounded-xl p-2.5 bg-blue-50 text-blue-600">
                <DollarSign className="h-5 w-5" />
              </div>
              <Badge variant="secondary" className="border-0 bg-blue-50 text-blue-600 text-xs">
                Asset
              </Badge>
            </div>
            <p className="mt-3 text-2xl font-bold text-foreground sm:mt-4">
              {formatCurrency(totalCostValuation)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">Total Inventory Cost</p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-none">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="rounded-xl p-2.5 bg-amber-50 text-amber-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <Badge variant="secondary" className="border-0 bg-amber-50 text-amber-600 text-xs">
                Potential
              </Badge>
            </div>
            <p className="mt-3 text-2xl font-bold text-foreground sm:mt-4">
              {formatCurrency(totalEstimatedRevenue)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">Estimated Stock Revenue</p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-none">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="rounded-xl p-2.5 bg-rose-50 text-rose-600">
                <Tag className="h-5 w-5" />
              </div>
              <Badge variant="secondary" className="border-0 bg-rose-50 text-rose-600 text-xs">
                Margin
              </Badge>
            </div>
            <p className="mt-3 text-2xl font-bold text-foreground sm:mt-4">
              {formatCurrency(totalPotentialProfit)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">Potential Gross Profit</p>
          </CardContent>
        </Card>
      </div>

      {/* Empty State Banner if no items exist */}
      {inventoryItems.length === 0 && !isInventoryLoading && (
        <Card className="border-2 border-dashed border-emerald-500/30 bg-card/60 p-8 text-center shadow-none">
          <div className="mx-auto flex max-w-md flex-col items-center justify-center space-y-3">
            <div className="rounded-full bg-emerald-500/10 p-4 text-emerald-600">
              <Package className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground">No Inventory Items Yet</h3>
            <p className="text-sm text-muted-foreground">
              Your database is clean and ready! Add your first products to start tracking real-time valuation, stock levels, and AI financial recommendations.
            </p>
            <Button
              onClick={() => setIsAddOpen(true)}
              className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Your First Item
            </Button>
          </div>
        </Card>
      )}

      {/* Charts & AI Section (Visible when items exist) */}
      {inventoryItems.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Inventory Valuation by Category */}
          <Card className="border border-border/60 shadow-none">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-foreground">
                Category Valuation Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-52 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      stroke="none"
                    >
                      {categoryData.map((_, idx) => (
                        <Cell
                          key={idx}
                          fill={PIE_COLORS[idx % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(0, 0%, 100%)",
                        border: "1px solid hsl(0, 0%, 90%)",
                        borderRadius: "8px",
                        color: "hsl(0, 0%, 20%)",
                      }}
                      formatter={(value: number) => [formatCurrency(value)]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                {categoryData.map((entry, idx) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: PIE_COLORS[idx % PIE_COLORS.length],
                      }}
                    />
                    <span className="text-xs text-muted-foreground">{entry.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Insights Card */}
          <Card className="border border-border/60 shadow-none">
            <CardHeader className="flex-row items-center gap-2 space-y-0 border-b border-border/40">
              <div className="rounded-xl bg-emerald-50 text-emerald-600 p-2">
                <Brain className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  StockShift AI Recommendations
                  <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchInsights}
                disabled={aiLoading}
                className="h-8 w-8"
              >
                <RefreshCw className={cn("h-4 w-4", aiLoading && "animate-spin")} />
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              {aiLoading && !insights ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Analyzing inventory data...</span>
                </div>
              ) : insights?.recommendations && insights.recommendations.length > 0 ? (
                <div className="space-y-3">
                  {insights.recommendations.slice(0, 3).map((rec, idx) => {
                    const urgency = URGENCY_CONFIG[rec.urgency] || URGENCY_CONFIG.low;
                    const TypeIcon = TYPE_ICON[rec.type] || Sparkles;
                    return (
                      <div
                        key={`${rec.sku}-${idx}`}
                        className="flex items-start gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="rounded-lg p-2 bg-emerald-50 text-emerald-600">
                          <TypeIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground">{rec.title}</p>
                            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 border", urgency.color)}>
                              {rec.urgency}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-center py-8 text-muted-foreground">
                  AI insights updated. Add more items or stock movements to get deep recommendations.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Low Stock Alerts & Recent Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Low Stock Alerts */}
        <Card className="border border-border/60 shadow-none">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm font-medium text-foreground">
              Low Stock Alerts
            </CardTitle>
            <Badge variant="secondary" className="ml-auto border-0 bg-amber-50 text-amber-600">
              {lowStockItems.length}
            </Badge>
          </CardHeader>
          <CardContent>
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All inventory items are above their reorder threshold.
              </p>
            ) : (
              <div className="space-y-3">
                {lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.sku}</p>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p className="text-sm font-semibold text-red-600">
                          {item.quantity} in stock
                        </p>
                        <p className="text-xs text-muted-foreground">Reorder at {item.reorderPoint}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border border-border/60 shadow-none">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Activity className="h-4 w-4 text-emerald-600" />
            <CardTitle className="text-sm font-medium text-foreground">
              Stock Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recent stock movements recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {transactions.slice(0, 5).map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {txn.itemName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        by {txn.performedBy}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="secondary"
                        className={
                          txn.type === "in"
                            ? "border-0 bg-emerald-50 text-emerald-600"
                            : "border-0 bg-red-50 text-red-600"
                        }
                      >
                        {txn.type === "in" ? "+" : "-"}
                        {txn.quantity}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(txn.date)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal: Quick Add Inventory Item */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Plus className="h-5 w-5 text-emerald-600" /> Add New Inventory Product
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddItem} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="item-name">Product Name *</Label>
                <Input
                  id="item-name"
                  placeholder="e.g. Wireless Mouse"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="item-sku">SKU Code *</Label>
                <Input
                  id="item-sku"
                  placeholder="e.g. ELEC-001"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="item-category">Category</Label>
                <Input
                  id="item-category"
                  placeholder="Electronics, Apparel..."
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="item-qty">Stock Quantity</Label>
                <Input
                  id="item-qty"
                  type="number"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="item-cost">Unit Cost (₹)</Label>
                <Input
                  id="item-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitCost}
                  onChange={(e) => setUnitCost(Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="item-sell">Selling Price (₹)</Label>
                <Input
                  id="item-sell"
                  type="number"
                  step="0.01"
                  min="0"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="item-reorder">Reorder Alert</Label>
                <Input
                  id="item-reorder"
                  type="number"
                  min="0"
                  value={reorderPoint}
                  onChange={(e) => setReorderPoint(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="item-location">Warehouse / Location</Label>
              <Input
                id="item-location"
                placeholder="e.g. Mumbai Main Hub"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Product
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
