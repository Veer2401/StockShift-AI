"use client";

import { useState, useMemo, useEffect } from "react";
import { useInventory } from "@/_lib/inventory-context";
import { formatCurrency, formatDate } from "@/_lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/_components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/_components/ui/card";
import { Badge } from "@/_components/ui/badge";
import { Slider } from "@/_components/ui/slider";
import { Separator } from "@/_components/ui/separator";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  PiggyBank,
  Calculator,
  Target,
  Sparkles,
  Package,
} from "lucide-react";
import type { AiRecommendation, CostEntry, YearlyForecastSummary } from "@/_lib/types";
import { generateAiLikeRecommendations } from "@/_lib/ai-finance";

const CHART_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(340, 82%, 52%)",
  "hsl(262, 83%, 58%)",
  "hsl(0, 0%, 65%)",
];

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(0, 0%, 100%)",
    border: "1px solid hsl(0, 0%, 90%)",
    borderRadius: "8px",
    color: "hsl(0, 0%, 20%)",
  },
  labelStyle: { color: "hsl(0, 0%, 45%)" },
};

export default function FinancePage() {
  const { items: inventoryItems, transactions } = useInventory();

  const [growthRate, setGrowthRate] = useState(10);
  const [recommendationHorizon, setRecommendationHorizon] = useState<30 | 60 | 90>(30);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);

  const [costEntries, setCostEntries] = useState<CostEntry[]>([]);
  const [costsLoading, setCostsLoading] = useState(false);

  const [yearlySummary, setYearlySummary] = useState<YearlyForecastSummary | null>(null);

  // Calculate AI Recommendations strictly from user's actual inventory items
  const recommendations = useMemo(() => {
    if (inventoryItems.length === 0) return [];
    return generateAiLikeRecommendations({
      items: inventoryItems,
      transactions,
      horizonDays: recommendationHorizon,
    });
  }, [inventoryItems, transactions, recommendationHorizon]);

  // Dynamically calculate Category Spending & Budget from user's inventory
  const categorySpending = useMemo(() => {
    const map: Record<string, number> = {};
    inventoryItems.forEach((item) => {
      const val = item.unitCost * item.quantity;
      map[item.category] = (map[item.category] || 0) + val;
    });
    return Object.entries(map).map(([category, amount]) => ({
      category,
      amount,
      budget: Math.round(amount * 1.25) || 10000,
    }));
  }, [inventoryItems]);

  // Dynamically calculate Monthly Summaries from transactions & stock
  const financialSummaries = useMemo(() => {
    if (inventoryItems.length === 0 && transactions.length === 0) {
      return [];
    }

    const currentTotalCost = inventoryItems.reduce((s, i) => s + i.unitCost * i.quantity, 0);
    const currentTotalRevenue = inventoryItems.reduce((s, i) => s + i.sellPrice * i.quantity, 0);

    if (transactions.length === 0) {
      const currentMonth = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
      return [
        {
          month: currentMonth,
          revenue: currentTotalRevenue,
          costs: currentTotalCost,
          profit: Math.max(0, currentTotalRevenue - currentTotalCost),
          itemsSold: 0,
          itemsPurchased: inventoryItems.reduce((s, i) => s + i.quantity, 0),
        },
      ];
    }

    const map: Record<string, { month: string; revenue: number; costs: number; profit: number; itemsSold: number; itemsPurchased: number }> = {};
    transactions.forEach((tx) => {
      const date = new Date(tx.date);
      const monthStr = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      if (!map[monthStr]) {
        map[monthStr] = { month: monthStr, revenue: 0, costs: 0, profit: 0, itemsSold: 0, itemsPurchased: 0 };
      }
      const item = inventoryItems.find((i) => i.id === tx.itemId || i.name === tx.itemName);
      const unitCost = item ? item.unitCost : 100;
      const sellPrice = item ? item.sellPrice : 150;

      if (tx.type === "in") {
        map[monthStr].costs += tx.quantity * unitCost;
        map[monthStr].itemsPurchased += tx.quantity;
      } else {
        map[monthStr].revenue += tx.quantity * sellPrice;
        map[monthStr].itemsSold += tx.quantity;
      }
      map[monthStr].profit = map[monthStr].revenue - map[monthStr].costs;
    });

    return Object.values(map);
  }, [inventoryItems, transactions]);

  // Top 5 Most Expensive Items by Valuation
  const topExpensiveItems = useMemo(
    () =>
      [...inventoryItems]
        .sort((a, b) => b.unitCost * b.quantity - a.unitCost * a.quantity)
        .slice(0, 5),
    [inventoryItems]
  );

  // Overall P&L Totals
  const plTotals = useMemo(() => {
    if (financialSummaries.length === 0) {
      const revenue = inventoryItems.reduce((s, i) => s + i.sellPrice * i.quantity, 0);
      const costs = inventoryItems.reduce((s, i) => s + i.unitCost * i.quantity, 0);
      const profit = Math.max(0, revenue - costs);
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      return { revenue, costs, profit, margin };
    }
    const revenue = financialSummaries.reduce((s, m) => s + m.revenue, 0);
    const costs = financialSummaries.reduce((s, m) => s + m.costs, 0);
    const profit = revenue - costs;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { revenue, costs, profit, margin };
  }, [financialSummaries, inventoryItems]);

  const revenueByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    inventoryItems.forEach((item) => {
      map[item.category] =
        (map[item.category] || 0) + item.sellPrice * item.quantity;
    });
    return Object.entries(map).map(([category, value]) => ({ category, value }));
  }, [inventoryItems]);

  const reorderAlerts = useMemo(
    () =>
      inventoryItems
        .filter((item) => item.quantity <= item.reorderPoint * 1.5)
        .map((item) => ({
          ...item,
          estimatedReorderCost: item.reorderPoint * item.unitCost * 2,
        })),
    [inventoryItems]
  );

  // Dynamic forecast based on user growth rate slider
  const forecastChartData = useMemo(() => {
    if (financialSummaries.length === 0) return [];
    const multiplier = 1 + growthRate / 100;
    const baseRev = plTotals.revenue || 50000;
    const baseCosts = plTotals.costs || 30000;

    return [
      ...financialSummaries.map((m) => ({
        month: m.month,
        historicalRevenue: m.revenue,
        historicalCosts: m.costs,
        forecastRevenue: undefined,
        forecastCosts: undefined,
      })),
      {
        month: "Next Month (+1m)",
        historicalRevenue: undefined,
        historicalCosts: undefined,
        forecastRevenue: Math.round(baseRev * multiplier),
        forecastCosts: Math.round(baseCosts * (1 + growthRate / 200)),
      },
      {
        month: "Month (+2m)",
        historicalRevenue: undefined,
        historicalCosts: undefined,
        forecastRevenue: Math.round(baseRev * Math.pow(multiplier, 1.2)),
        forecastCosts: Math.round(baseCosts * Math.pow(1 + growthRate / 200, 1.2)),
      },
    ];
  }, [financialSummaries, plTotals, growthRate]);

  const cashFlowProjections = useMemo(() => {
    const baseRev = plTotals.revenue || 50000;
    const baseCosts = plTotals.costs || 30000;
    const multiplier = 1 + growthRate / 100;

    return [1, 2, 3].map((m) => {
      const rev = Math.round(baseRev * Math.pow(multiplier, m * 0.5));
      const costs = Math.round(baseCosts * Math.pow(1 + growthRate / 200, m * 0.5));
      return {
        month: `Month +${m}`,
        revenue: rev,
        costs: costs,
        netCashFlow: rev - costs,
      };
    });
  }, [plTotals, growthRate]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl text-foreground">
          Financial Planner &amp; Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time cost tracking, P&amp;L analysis, and AI financial forecasting based on your inventory database.
        </p>
      </div>

      <Tabs defaultValue="recommendations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 max-w-3xl">
          <TabsTrigger
            value="recommendations"
            className="gap-1 sm:gap-2 text-xs sm:text-sm"
          >
            <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" />
            <span className="hidden sm:inline">AI</span> Recs
          </TabsTrigger>
          <TabsTrigger value="costs" className="gap-1 sm:gap-2 text-xs sm:text-sm">
            <Calculator className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Cost</span> Tracking
          </TabsTrigger>
          <TabsTrigger value="pnl" className="gap-1 sm:gap-2 text-xs sm:text-sm">
            <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            P&amp;L
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-1 sm:gap-2 text-xs sm:text-sm">
            <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Fore</span>cast
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: AI Recommendations ── */}
        <TabsContent value="recommendations" className="space-y-6">
          <Card className="border border-border/60 shadow-none">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-emerald-600" />
                  AI Stock Optimization Recommendations
                </CardTitle>
                <CardDescription>
                  Suggested stock levels based on your inventory history and planning horizon.
                </CardDescription>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Planning horizon (days)</p>
                <div className="inline-flex rounded-md border bg-background p-0.5 text-xs">
                  {[30, 60, 90].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setRecommendationHorizon(h as 30 | 60 | 90)}
                      className={`px-3 py-1 rounded-sm font-medium transition-colors ${
                        recommendationHorizon === h
                          ? "bg-emerald-600 text-white"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {h}d
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {recLoading && (
                <p className="text-sm text-muted-foreground py-6 text-center">Loading AI recommendations...</p>
              )}
              {recError && (
                <p className="text-sm text-destructive py-6 text-center">{recError}</p>
              )}
              {!recLoading && !recError && recommendations.length === 0 && (
                <div className="text-center py-8 space-y-2">
                  <Package className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm font-medium text-foreground">No Stock Recommendations Yet</p>
                  <p className="text-xs text-muted-foreground">Add products to your inventory to generate automated stock recommendations.</p>
                </div>
              )}
              {!recLoading && !recError && recommendations.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-3 pr-4 font-medium">Item</th>
                        <th className="text-left py-3 pr-4 font-medium">Horizon</th>
                        <th className="text-right py-3 pr-4 font-medium">Current Stock</th>
                        <th className="text-right py-3 pr-4 font-medium">Recommended</th>
                        <th className="text-right py-3 pr-4 font-medium">% Change</th>
                        <th className="text-left py-3 pr-4 font-medium">Confidence</th>
                        <th className="text-left py-3 font-medium">Rationale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recommendations.map((rec) => (
                        <tr key={rec.id} className="border-b last:border-0 align-top">
                          <td className="py-3 pr-4 font-medium text-foreground">{rec.itemName}</td>
                          <td className="py-3 pr-4 text-xs text-muted-foreground">
                            {rec.timeHorizon}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums">
                            {rec.currentStock}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums font-semibold">
                            {rec.recommendedStock}
                          </td>
                          <td
                            className={`py-3 pr-4 text-right tabular-nums font-medium ${
                              rec.changePercent >= 0 ? "text-emerald-600" : "text-destructive"
                            }`}
                          >
                            {rec.changePercent > 0 ? "+" : ""}
                            {rec.changePercent}%
                          </td>
                          <td className="py-3 pr-4">
                            <Badge variant="outline" className="text-xs">
                              {rec.confidence}
                            </Badge>
                          </td>
                          <td className="py-3 text-xs text-muted-foreground max-w-md">
                            {rec.rationale}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Cost Tracking ── */}
        <TabsContent value="costs" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border border-border/60 shadow-none">
              <CardHeader>
                <CardTitle className="text-lg">Monthly Cost Movements</CardTitle>
                <CardDescription>
                  Real cost values based on inventory transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {financialSummaries.length === 0 ? (
                  <p className="text-sm text-center py-12 text-muted-foreground">
                    No transaction costs recorded yet. Add inventory items to visualize cost trends.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={financialSummaries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,90%)" />
                      <XAxis dataKey="month" tick={{ fill: "hsl(0,0%,60%)", fontSize: 12 }} />
                      <YAxis
                        tick={{ fill: "hsl(0,0%,60%)", fontSize: 12 }}
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value: number) => [formatCurrency(value), "Costs"]}
                      />
                      <Bar dataKey="costs" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-none">
              <CardHeader>
                <CardTitle className="text-lg">Inventory Valuation by Category</CardTitle>
                <CardDescription>Cost distribution across your product categories</CardDescription>
              </CardHeader>
              <CardContent>
                {categorySpending.length === 0 ? (
                  <p className="text-sm text-center py-12 text-muted-foreground">
                    No categories found. Create inventory items to track category valuation.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categorySpending} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,90%)" />
                      <XAxis
                        type="number"
                        tick={{ fill: "hsl(0,0%,60%)", fontSize: 12 }}
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      />
                      <YAxis
                        dataKey="category"
                        type="category"
                        width={120}
                        tick={{ fill: "hsl(0,0%,60%)", fontSize: 12 }}
                      />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value: number) => [formatCurrency(value), "Valuation"]}
                      />
                      <Bar dataKey="amount" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top 5 Most Expensive Items */}
          <Card className="border border-border/60 shadow-none">
            <CardHeader>
              <CardTitle className="text-lg">Top 5 Highest Value Inventory Products</CardTitle>
              <CardDescription>
                Ranked by total capital tied up (Unit Cost &times; Quantity)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topExpensiveItems.length === 0 ? (
                <p className="text-sm text-center py-6 text-muted-foreground">
                  No products in database yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-3 pr-4 font-medium">#</th>
                        <th className="text-left py-3 pr-4 font-medium">Product Name</th>
                        <th className="text-left py-3 pr-4 font-medium">Category</th>
                        <th className="text-right py-3 pr-4 font-medium">Unit Cost</th>
                        <th className="text-right py-3 pr-4 font-medium">Qty</th>
                        <th className="text-right py-3 font-medium">Total Capital Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topExpensiveItems.map((item, idx) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="py-3 pr-4 text-muted-foreground">{idx + 1}</td>
                          <td className="py-3 pr-4 font-medium text-foreground">{item.name}</td>
                          <td className="py-3 pr-4">
                            <Badge variant="secondary">{item.category}</Badge>
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums">
                            {formatCurrency(item.unitCost)}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums font-semibold">
                            {item.quantity}
                          </td>
                          <td className="py-3 text-right font-bold tabular-nums text-emerald-600">
                            {formatCurrency(item.unitCost * item.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Profit & Loss ── */}
        <TabsContent value="pnl" className="space-y-6">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="border border-border/60 shadow-none">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Estimated Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(plTotals.revenue)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total Stock Selling Value</p>
              </CardContent>
            </Card>
            <Card className="border border-border/60 shadow-none">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Total Capital COGS</CardTitle>
                <TrendingDown className="h-4 w-4 text-rose-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(plTotals.costs)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Cost of Goods Invested</p>
              </CardContent>
            </Card>
            <Card className="border border-border/60 shadow-none">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Potential Gross Profit</CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(plTotals.profit)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Estimated Net Gain</p>
              </CardContent>
            </Card>
            <Card className="border border-border/60 shadow-none">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Gross Margin %</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {plTotals.margin.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">Overall Product Margin</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-border/60 shadow-none">
            <CardHeader>
              <CardTitle className="text-lg">Revenue vs Cost Breakdown by Category</CardTitle>
              <CardDescription>Estimated revenue potential grouped by product category</CardDescription>
            </CardHeader>
            <CardContent>
              {revenueByCategory.length === 0 ? (
                <p className="text-sm text-center py-8 text-muted-foreground">
                  Add inventory products to view category revenue breakdown.
                </p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueByCategory}
                        dataKey="value"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={50}
                        paddingAngle={3}
                      >
                        {revenueByCategory.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value: number) => [formatCurrency(value), "Est. Revenue"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 4: Forecasting ── */}
        <TabsContent value="forecast" className="space-y-6">
          <Card className="border border-border/60 shadow-none">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5 text-emerald-600" />
                Growth Rate What-If Simulator
              </CardTitle>
              <CardDescription>
                Adjust predicted business growth rate to model future monthly revenue and profit targets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3 max-w-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Expected Growth Modifier</span>
                  <Badge variant="outline" className="text-base font-bold px-3">
                    {growthRate}%
                  </Badge>
                </div>
                <Slider
                  value={[growthRate]}
                  onValueChange={(v) => setGrowthRate(v[0])}
                  min={0}
                  max={50}
                  step={1}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-3">
                {cashFlowProjections.map((d) => (
                  <div key={d.month} className="rounded-lg border p-4 space-y-3 bg-card">
                    <p className="font-semibold text-sm text-foreground">{d.month}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Projected Revenue</span>
                        <span className="font-medium tabular-nums text-foreground">
                          {formatCurrency(d.revenue)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Projected Costs</span>
                        <span className="font-medium tabular-nums text-rose-500">
                          {formatCurrency(d.costs)}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Net Profit</span>
                        <span className="font-bold tabular-nums text-emerald-600">
                          {formatCurrency(d.netCashFlow)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
