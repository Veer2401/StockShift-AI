"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { useInventory } from "@/_lib/inventory-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/_components/ui/card";
import { Button } from "@/_components/ui/button";
import { Badge } from "@/_components/ui/badge";
import { DollarSign, TrendingDown, TrendingUp, AlertTriangle, Plus, Package } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/_lib/utils";
import { LiquidationRadar } from "./components/LiquidationRadar";

export default function CostOptimizationPage() {
  const { items: inventoryItems, isLoading } = useInventory();

  // Dynamically compute cost optimization metrics from real user inventory
  const costMetrics = useMemo(() => {
    if (inventoryItems.length === 0) {
      return null;
    }

    const totalCapitalLocked = inventoryItems.reduce(
      (sum, item) => sum + item.unitCost * item.quantity,
      0
    );

    const overstockItems = inventoryItems.filter(
      (item) => item.quantity > item.reorderPoint * 2.5
    );

    const overstockCapital = overstockItems.reduce(
      (sum, item) => sum + item.unitCost * Math.max(0, item.quantity - item.reorderPoint * 2),
      0
    );

    const stockoutRiskItems = inventoryItems.filter(
      (item) => item.quantity <= item.reorderPoint
    );

    const stockoutRiskCost = stockoutRiskItems.reduce(
      (sum, item) => sum + item.sellPrice * Math.max(1, item.reorderPoint - item.quantity),
      0
    );

    const holdingCostMonthly = totalCapitalLocked * 0.02; // Standard 2% monthly holding cost
    const potentialSavings = overstockCapital * 0.15 + stockoutRiskCost * 0.25;

    // Build dynamic AI recommendations
    const recommendations: Array<{ action: string; impact: string; priority: "high" | "medium" | "low" }> = [];

    stockoutRiskItems.forEach((item) => {
      recommendations.push({
        action: `Reorder stock for ${item.name} (${item.sku}). Current stock (${item.quantity}) is below reorder threshold (${item.reorderPoint}).`,
        impact: `Prevents potential revenue loss of ${formatCurrency(item.sellPrice * (item.reorderPoint - item.quantity + 5))}`,
        priority: item.quantity === 0 ? "high" : "medium",
      });
    });

    overstockItems.forEach((item) => {
      recommendations.push({
        action: `Reduce purchase order volume for ${item.name} (${item.sku}). Excess inventory of ${item.quantity - item.reorderPoint * 2} units detected.`,
        impact: `Frees up ${formatCurrency(item.unitCost * (item.quantity - item.reorderPoint * 2))} in working capital`,
        priority: "high",
      });
    });

    if (recommendations.length === 0) {
      recommendations.push({
        action: "Inventory levels across all product SKUs are currently optimal.",
        impact: "Holding costs and stockout risks are balanced.",
        priority: "low",
      });
    }

    return {
      totalCapitalLocked,
      overstockCapital,
      stockoutRiskCost,
      holdingCostMonthly,
      potentialSavings,
      overstockItems,
      stockoutRiskItems,
      recommendations,
    };
  }, [inventoryItems]);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground text-sm">Analyzing inventory database...</p>
      </div>
    );
  }

  // Clean empty state when no items added yet
  if (inventoryItems.length === 0 || !costMetrics) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <DollarSign className="w-7 h-7 text-emerald-600" />
            Cost Optimization Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time capital, holding cost, and overstock analysis.
          </p>
        </div>

        <Card className="border-2 border-dashed border-emerald-500/30 bg-card/60 p-8 text-center shadow-none">
          <div className="mx-auto flex max-w-md flex-col items-center justify-center space-y-3">
            <div className="rounded-full bg-emerald-500/10 p-4 text-emerald-600">
              <Package className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground">No Inventory Items Found</h3>
            <p className="text-sm text-muted-foreground">
              Your cost optimization dashboard dynamically tracks capital locked, overstock risks, and holding costs once products are added to your database.
            </p>
            <Link href="/admin/dashboard">
              <Button className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                <Plus className="h-4 w-4 mr-2" /> Add Inventory Items
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2.5 text-foreground sm:text-2xl tracking-tight">
          <DollarSign className="w-7 h-7 text-emerald-600" />
          Cost Optimization Dashboard
        </h1>
        <p className="text-sm text-muted-foreground font-medium mt-1">
          Real-time capital, holding cost, and overstock analysis calculated from your inventory database.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:scale-[1.01] transition-all">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              Total Capital Locked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(costMetrics.totalCapitalLocked)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Current inventory valuation</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-amber-600 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Overstock Capital
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(costMetrics.overstockCapital)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {costMetrics.overstockItems.length} items overstocked
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-rose-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Stockout Risk Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">
              {formatCurrency(costMetrics.stockoutRiskCost)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {costMetrics.stockoutRiskItems.length} items at reorder threshold
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-emerald-600 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Potential Monthly Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(costMetrics.potentialSavings)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">By optimizing reorders &amp; stock</p>
          </CardContent>
        </Card>
      </div>

      {/* Capital Liquidation & Shrinkage Radar */}
      <LiquidationRadar />

      {/* Holding Cost */}
      <Card className="border-border/60 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Monthly Holding Cost Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Current Monthly Holding Cost (2% of inventory value)</span>
              <span className="font-semibold">{formatCurrency(costMetrics.holdingCostMonthly)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Annualized Holding Cost</span>
              <span className="font-semibold text-amber-600">{formatCurrency(costMetrics.holdingCostMonthly * 12)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t text-sm">
              <span className="font-medium">Potential Annual Savings</span>
              <span className="font-bold text-emerald-600 text-base">{formatCurrency(costMetrics.potentialSavings * 12)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Recommendations */}
      <Card className="border-border/60 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <TrendingDown className="w-5 h-5 text-emerald-600" />
            Prioritized Cost Optimization Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {costMetrics.recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="p-4 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="secondary"
                        className={
                          rec.priority === "high"
                            ? "bg-rose-50 text-rose-600 border-0"
                            : rec.priority === "medium"
                            ? "bg-amber-50 text-amber-600 border-0"
                            : "bg-emerald-50 text-emerald-600 border-0"
                        }
                      >
                        {rec.priority.toUpperCase()} PRIORITY
                      </Badge>
                      <Link href="/admin/purchase-orders">
                        <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                          ⚡ Auto-Draft Purchase Order
                        </Button>
                      </Link>
                    </div>
                    <p className="font-medium text-sm text-foreground pt-1">{rec.action}</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">💰 Impact: {rec.impact}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Overstock & Stockout Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/60 shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-amber-600">Overstocked Products</CardTitle>
          </CardHeader>
          <CardContent>
            {costMetrics.overstockItems.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No overstocked items detected.</p>
            ) : (
              <div className="space-y-2">
                {costMetrics.overstockItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-xs bg-amber-500/10 px-3 py-2 rounded border border-amber-500/20">
                    <span className="font-medium text-foreground">{item.name} ({item.sku})</span>
                    <span className="text-amber-600 font-semibold">{item.quantity} in stock</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-rose-600">Stockout Risk Products</CardTitle>
          </CardHeader>
          <CardContent>
            {costMetrics.stockoutRiskItems.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No stockout risks detected.</p>
            ) : (
              <div className="space-y-2">
                {costMetrics.stockoutRiskItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-xs bg-rose-500/10 px-3 py-2 rounded border border-rose-500/20">
                    <span className="font-medium text-foreground">{item.name} ({item.sku})</span>
                    <span className="text-rose-600 font-semibold">{item.quantity} in stock</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
