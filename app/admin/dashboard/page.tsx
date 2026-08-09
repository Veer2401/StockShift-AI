"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import {
  Package,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Activity,
  Brain,
  RefreshCw,
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/_components/ui/select";
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

function getSectorSku(category: string, existingItems: { sku: string }[]): string {
  if (!category) return "";
  const cat = category.toLowerCase().trim();
  let prefix = "SKU";
  if (cat.includes("dairy")) prefix = "DRY";
  else if (cat.includes("grain") || cat.includes("rice")) prefix = "GRN";
  else if (cat.includes("flour") || cat.includes("staple")) prefix = "STP";
  else if (cat.includes("oil") || cat.includes("fat") || cat.includes("ghee")) prefix = "OIL";
  else if (cat.includes("pulse") || cat.includes("legume") || cat.includes("dal")) prefix = "PLS";
  else if (cat.includes("spice") || cat.includes("seasoning") || cat.includes("masala")) prefix = "SPC";
  else if (cat.includes("beverage") || cat.includes("drink") || cat.includes("tea") || cat.includes("coffee")) prefix = "BEV";
  else if (cat.includes("condiment") || cat.includes("sauce")) prefix = "CND";
  else if (cat.includes("dry fruit") || cat.includes("nut")) prefix = "DFT";
  else if (cat.includes("snack") || cat.includes("biscuit") || cat.includes("chip")) prefix = "SNK";
  else if (cat.includes("personal") || cat.includes("care") || cat.includes("soap")) prefix = "PCR";
  else if (cat.includes("house") || cat.includes("clean")) prefix = "HSD";
  else if (cat.includes("audio") || cat.includes("headphone") || cat.includes("speaker")) prefix = "AUD";
  else if (cat.includes("accessory") || cat.includes("cable") || cat.includes("charger")) prefix = "ACC";
  else if (cat.includes("peripheral") || cat.includes("mouse") || cat.includes("keyboard")) prefix = "PER";
  else if (cat.includes("display") || cat.includes("monitor") || cat.includes("screen")) prefix = "DSP";
  else if (cat.includes("otc") || cat.includes("medicine") || cat.includes("pharm")) prefix = "OTC";
  else if (cat.includes("device") || cat.includes("equipment")) prefix = "DEV";
  else if (cat.includes("supplement") || cat.includes("vitamin")) prefix = "SUP";
  else if (cat.includes("aid") || cat.includes("first")) prefix = "AID";
  else if (cat.includes("topwear") || cat.includes("shirt") || cat.includes("tee")) prefix = "TOP";
  else if (cat.includes("bottomwear") || cat.includes("jean") || cat.includes("trouser")) prefix = "BTM";
  else if (cat.includes("footwear") || cat.includes("shoe")) prefix = "FTW";
  else if (cat.includes("power") || cat.includes("tool")) prefix = "PWR";
  else if (cat.includes("fastener") || cat.includes("screw") || cat.includes("bolt")) prefix = "FST";
  else if (cat.includes("metal") || cat.includes("steel") || cat.includes("aluminum")) prefix = "MTL";
  else {
    const clean = category.replace(/[^a-zA-Z]/g, "").toUpperCase();
    prefix = clean.length >= 3 ? clean.slice(0, 3) : "SKU";
  }

  const existingCount = existingItems.filter((i) => i.sku && i.sku.toUpperCase().startsWith(prefix)).length;
  return `${prefix}-${String(existingCount + 1).padStart(3, "0")}`;
}

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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className="space-y-6"
    >
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent backdrop-blur-md p-5 sm:p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {user?.companyName || "Your Business Workspace"}
            </h2>
          </div>
          {user?.city && user?.state && (
            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
              <span>{user.city}, {user.state} (India)</span>
            </p>
          )}
        </div>
        <Button
          onClick={() => setIsAddOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4 mr-2" /> Add Inventory Item
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="hover:scale-[1.01] transition-all">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="rounded-xl p-2.5 bg-emerald-50 text-emerald-600 shadow-2xs">
                <Boxes className="h-5 w-5" />
              </div>
              <Badge variant="secondary" className="border-0 bg-emerald-50 text-emerald-600 text-xs rounded-lg font-semibold">
                Active
              </Badge>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:mt-4 sm:text-3xl">
              {totalItemsCount.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm font-medium">Total Inventory Stock</p>
          </CardContent>
        </Card>

        <Card className="hover:scale-[1.01] transition-all">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="rounded-xl p-2.5 bg-blue-50 text-blue-600 shadow-2xs">
                <DollarSign className="h-5 w-5" />
              </div>
              <Badge variant="secondary" className="border-0 bg-blue-50 text-blue-600 text-xs rounded-lg font-semibold">
                Asset
              </Badge>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:mt-4 sm:text-3xl">
              {formatCurrency(totalCostValuation)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm font-medium">Total Inventory Cost</p>
          </CardContent>
        </Card>

        <Card className="hover:scale-[1.01] transition-all">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="rounded-xl p-2.5 bg-amber-50 text-amber-600 shadow-2xs">
                <TrendingUp className="h-5 w-5" />
              </div>
              <Badge variant="secondary" className="border-0 bg-amber-50 text-amber-600 text-xs rounded-lg font-semibold">
                Potential
              </Badge>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:mt-4 sm:text-3xl">
              {formatCurrency(totalEstimatedRevenue)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm font-medium">Estimated Stock Revenue</p>
          </CardContent>
        </Card>

        <Card className="hover:scale-[1.01] transition-all">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="rounded-xl p-2.5 bg-rose-50 text-rose-600 shadow-2xs">
                <Tag className="h-5 w-5" />
              </div>
              <Badge variant="secondary" className="border-0 bg-rose-50 text-rose-600 text-xs rounded-lg font-semibold">
                Margin
              </Badge>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:mt-4 sm:text-3xl">
              {formatCurrency(totalPotentialProfit)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm font-medium">Potential Gross Profit</p>
          </CardContent>
        </Card>
      </div>

      {/* Empty State Banner if no items exist */}
      {inventoryItems.length === 0 && !isInventoryLoading && (
        <Card className="border-2 border-dashed border-emerald-500/30 p-8 text-center shadow-none">
          <div className="mx-auto flex max-w-md flex-col items-center justify-center space-y-3">
            <div className="rounded-full bg-emerald-500/10 p-4 text-emerald-600 shadow-2xs">
              <Package className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold tracking-tight text-foreground">No Inventory Items Yet</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your database is clean and ready! Add your first products to start tracking real-time valuation, stock levels, and AI financial recommendations.
            </p>
            <Button
              onClick={() => setIsAddOpen(true)}
              className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl active:scale-95"
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
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
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
                        backgroundColor: "rgba(255, 255, 255, 0.9)",
                        backdropFilter: "blur(12px)",
                        border: "1px solid rgba(255, 255, 255, 0.6)",
                        borderRadius: "12px",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
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
                    <span className="text-xs text-muted-foreground font-medium">{entry.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Insights Card */}
          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0 border-b border-black/5 dark:border-white/10 pb-3">
              <div className="rounded-xl bg-emerald-50 text-emerald-600 p-2 shadow-2xs">
                <Brain className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
                  StockShift AI Recommendations
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchInsights}
                disabled={aiLoading}
                className="h-8 w-8 rounded-xl active:scale-95"
              >
                <RefreshCw className={cn("h-4 w-4", aiLoading && "animate-spin")} />
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              {aiLoading && !insights ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                  <span className="text-sm font-medium">Analyzing inventory data...</span>
                </div>
              ) : insights?.recommendations && insights.recommendations.length > 0 ? (
                <div className="space-y-3">
                  {insights.recommendations.slice(0, 3).map((rec, idx) => {
                    const urgency = URGENCY_CONFIG[rec.urgency] || URGENCY_CONFIG.low;
                    const TypeIcon = TYPE_ICON[rec.type] || TrendingUp;
                    return (
                      <div
                        key={`${rec.sku}-${idx}`}
                        className="flex items-start gap-3 rounded-xl border border-black/5 dark:border-white/10 bg-white/50 dark:bg-zinc-800/50 p-3 hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-150 active:scale-[0.99]"
                      >
                        <div className="rounded-lg p-2 bg-emerald-50 text-emerald-600">
                          <TypeIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground tracking-tight">{rec.title}</p>
                            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 border rounded-md font-semibold", urgency.color)}>
                              {rec.urgency}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-normal">{rec.description}</p>
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
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0 pb-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
              Low Stock Alerts
            </CardTitle>
            <Badge variant="secondary" className="ml-auto border-0 bg-amber-50 text-amber-600 rounded-lg font-semibold">
              {lowStockItems.length}
            </Badge>
          </CardHeader>
          <CardContent>
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                All inventory items are above their reorder threshold.
              </p>
            ) : (
              <div className="space-y-2.5">
                {lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-black/5 dark:border-white/10 bg-white/50 dark:bg-zinc-800/50 px-3.5 py-2.5 hover:bg-black/5 transition-all active:scale-[0.99]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground tracking-tight">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.sku}</p>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p className="text-sm font-bold text-red-600">
                          {item.quantity} in stock
                        </p>
                        <p className="text-xs text-muted-foreground font-medium">Reorder at {item.reorderPoint}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0 pb-3">
            <Activity className="h-4 w-4 text-emerald-600" />
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
              Stock Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No recent stock movements recorded yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {transactions.slice(0, 5).map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between rounded-xl border border-black/5 dark:border-white/10 bg-white/50 dark:bg-zinc-800/50 px-3.5 py-2.5 hover:bg-black/5 transition-all active:scale-[0.99]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground tracking-tight">
                        {txn.itemName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        by {txn.performedBy}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "border-0 rounded-md font-bold px-2 py-0.5",
                          txn.type === "in"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-red-50 text-red-600"
                        )}
                      >
                        {txn.type === "in" ? "+" : "-"}
                        {txn.quantity}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-medium">
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
            {/* Existing SKU Selector Dropdown */}
            {inventoryItems.length > 0 && (
              <div className="space-y-1.5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-600" /> Select Existing SKU Code
                  </span>
                  <span className="text-[11px] text-muted-foreground font-medium">Auto-fills details</span>
                </div>
                <Select
                  onValueChange={(selectedSku) => {
                    if (!selectedSku || selectedSku === "__NEW__") return;
                    const matched = inventoryItems.find((i) => i.sku === selectedSku);
                    if (matched) {
                      setSku(matched.sku);
                      setName(matched.name);
                      setCategory(matched.category);
                      setQuantity(matched.quantity);
                      setUnitCost(matched.unitCost);
                      setSellPrice(matched.sellPrice);
                      setReorderPoint(matched.reorderPoint);
                      setLocation(matched.location || "");
                    }
                  }}
                >
                  <SelectTrigger className="w-full text-xs h-9 bg-white/80 dark:bg-zinc-800/80 rounded-xl font-medium border-emerald-500/30">
                    <SelectValue placeholder="Choose from available SKU codes..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56 rounded-xl">
                    <SelectItem value="__NEW__" className="text-xs text-muted-foreground italic">
                      + Enter a new custom SKU instead
                    </SelectItem>
                    {inventoryItems.map((item) => (
                      <SelectItem key={item.id} value={item.sku} className="text-xs">
                        <span className="font-mono font-bold text-foreground">{item.sku}</span> — {item.name} ({item.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
                  onChange={(e) => {
                    const newSku = e.target.value;
                    setSku(newSku);
                    if (newSku.trim()) {
                      const matched = inventoryItems.find((i) => i.sku.toLowerCase() === newSku.trim().toLowerCase());
                      if (matched) {
                        setName(matched.name);
                        setCategory(matched.category);
                        setUnitCost(matched.unitCost);
                        setSellPrice(matched.sellPrice);
                        setReorderPoint(matched.reorderPoint);
                        setLocation(matched.location || "");
                      }
                    }
                  }}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="item-category">Category / Sector</Label>
                <Input
                  id="item-category"
                  placeholder="Raw Dairy, Spices, Beverages..."
                  value={category}
                  onChange={(e) => {
                    const newCat = e.target.value;
                    setCategory(newCat);
                    if (!sku || sku.trim() === "") {
                      setSku(getSectorSku(newCat, inventoryItems));
                    }
                  }}
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
    </motion.div>
  );
}
