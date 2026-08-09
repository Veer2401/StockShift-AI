"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { useInventory } from "@/_lib/inventory-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/_components/ui/card";
import { Button } from "@/_components/ui/button";
import { Badge } from "@/_components/ui/badge";
import { Warehouse, ArrowRight, TrendingUp, Building2, Package, Plus } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/_lib/utils";

export default function WarehouseOptimizationPage() {
  const { items: inventoryItems, isLoading } = useInventory();

  const warehouseData = useMemo(() => {
    if (inventoryItems.length === 0) return null;

    // Group items by location
    const locationMap: Record<string, typeof inventoryItems> = {};
    inventoryItems.forEach((item) => {
      const loc = item.location || "Primary Location";
      if (!locationMap[loc]) locationMap[loc] = [];
      locationMap[loc].push(item);
    });

    const warehouses = Object.entries(locationMap).map(([location, items]) => {
      const total_skus = items.length;
      const total_value = items.reduce((sum, i) => sum + i.unitCost * i.quantity, 0);
      const overstock_items = items.filter((i) => i.quantity > i.reorderPoint * 2.5).length;
      const stockout_risk_items = items.filter((i) => i.quantity <= i.reorderPoint).length;

      return {
        location,
        total_skus,
        total_value,
        overstock_items,
        stockout_risk_items,
      };
    });

    const totalOverstock = warehouses.reduce((sum, w) => sum + w.overstock_items, 0);
    const totalStockout = warehouses.reduce((sum, w) => sum + w.stockout_risk_items, 0);
    const network_health_score = Math.max(
      20,
      Math.min(100, 100 - totalOverstock * 10 - totalStockout * 15)
    );

    // Build transfer recommendations if multiple locations exist
    const transfer_recommendations: Array<{
      sku: string;
      name: string;
      from_location: string;
      to_location: string;
      qty_to_transfer: number;
      reason: string;
      transfer_cost_estimate: number;
      stockout_cost_prevented: number;
      net_benefit: number;
      priority: "high" | "medium" | "low";
    }> = [];

    const locations = Object.keys(locationMap);
    if (locations.length >= 2) {
      const locA = locations[0];
      const locB = locations[1];
      const itemsA = locationMap[locA];

      itemsA.forEach((item) => {
        if (item.quantity > item.reorderPoint * 2) {
          const qty_to_transfer = Math.floor((item.quantity - item.reorderPoint) / 2);
          const transfer_cost_estimate = 500;
          const stockout_cost_prevented = item.sellPrice * qty_to_transfer;
          const net_benefit = stockout_cost_prevented - transfer_cost_estimate;

          transfer_recommendations.push({
            sku: item.sku,
            name: item.name,
            from_location: locA,
            to_location: locB,
            qty_to_transfer,
            reason: `Rebalance surplus stock at ${locA} to support demand at ${locB}.`,
            transfer_cost_estimate,
            stockout_cost_prevented,
            net_benefit: Math.max(0, net_benefit),
            priority: "medium",
          });
        }
      });
    }

    const total_transfer_savings = transfer_recommendations.reduce(
      (sum, t) => sum + t.net_benefit,
      0
    );

    return {
      warehouses,
      network_health_score,
      transfer_recommendations,
      total_transfer_savings,
    };
  }, [inventoryItems]);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground text-sm">Analyzing warehouse network...</p>
      </div>
    );
  }

  if (inventoryItems.length === 0 || !warehouseData) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <Warehouse className="w-7 h-7 text-emerald-600" />
            Multi-Warehouse Optimization
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Balance inventory across storage locations to minimize stockouts and shipping costs.
          </p>
        </div>

        <Card className="border-2 border-dashed border-emerald-500/30 bg-card/60 p-8 text-center shadow-none">
          <div className="mx-auto flex max-w-md flex-col items-center justify-center space-y-3">
            <div className="rounded-full bg-emerald-500/10 p-4 text-emerald-600">
              <Package className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground">No Warehouse Items Found</h3>
            <p className="text-sm text-muted-foreground">
              Add items and specify storage locations to unlock warehouse network balance scoring and transfer recommendations.
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
          <Warehouse className="w-7 h-7 text-emerald-600" />
          Multi-Warehouse Optimization
        </h1>
        <p className="text-sm text-muted-foreground font-medium mt-1">
          Balance stock across your locations to minimize holding costs and order delays.
        </p>
      </div>

      {/* Network Health Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Warehouse Network Balance Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="text-4xl font-bold text-foreground sm:text-5xl">
              {warehouseData.network_health_score}
              <span className="text-xl text-muted-foreground">/100</span>
            </div>
            <div className="flex-1">
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-500"
                  style={{ width: `${warehouseData.network_health_score}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {warehouseData.network_health_score >= 80
                  ? "Optimal stock balance across storage locations"
                  : warehouseData.network_health_score >= 60
                  ? "Good balance, minor rebalancing recommended"
                  : "Uneven inventory distribution across locations"}
              </p>
            </div>
          </div>
          {warehouseData.total_transfer_savings > 0 && (
            <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 rounded-lg">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                💰 Potential savings from recommended stock transfers: {formatCurrency(warehouseData.total_transfer_savings)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warehouse Overview */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-foreground">
          <Building2 className="w-4 h-4 text-emerald-600" />
          Location Distribution
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouseData.warehouses.map((wh) => (
            <Card key={wh.location} className="border-border/60 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-foreground">{wh.location}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total SKUs:</span>
                  <span className="font-semibold text-foreground">{wh.total_skus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stock Valuation:</span>
                  <span className="font-semibold text-foreground">{formatCurrency(wh.total_value)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overstock SKUs:</span>
                  <span className="font-semibold text-amber-600">{wh.overstock_items}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stockout Risk SKUs:</span>
                  <span className="font-semibold text-rose-600">{wh.stockout_risk_items}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Transfer Recommendations */}
      <Card className="border-border/60 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ArrowRight className="w-5 h-5 text-emerald-600" />
            Inter-Location Transfer Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {warehouseData.transfer_recommendations.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No inter-location transfers required right now. Stock is well distributed across your current locations.
            </p>
          ) : (
            <div className="space-y-4">
              {warehouseData.transfer_recommendations.map((transfer, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                        {transfer.name}
                        <span className="text-xs text-muted-foreground">({transfer.sku})</span>
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{transfer.from_location}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-medium text-foreground">{transfer.to_location}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-0">
                      {transfer.priority.toUpperCase()} PRIORITY
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3 text-xs">
                    <div>
                      <p className="text-muted-foreground mb-0.5">Transfer Quantity</p>
                      <p className="font-semibold text-sm text-foreground">{transfer.qty_to_transfer} units</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-0.5">Net Benefit</p>
                      <p className="font-semibold text-sm text-emerald-600">
                        {formatCurrency(transfer.net_benefit)}
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-background border border-border/60 rounded text-xs">
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">💡 Reason: </span>
                      {transfer.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
