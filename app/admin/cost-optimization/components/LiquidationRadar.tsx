"use client";

import { useMemo } from "react";
import { useInventory } from "@/_lib/inventory-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/_components/ui/card";
import { Badge } from "@/_components/ui/badge";
import { Button } from "@/_components/ui/button";
import { ShieldAlert, Flame, TrendingDown, ArrowRight, AlertOctagon } from "lucide-react";
import { formatCurrency } from "@/_lib/utils";

export function LiquidationRadar() {
  const { items: inventoryItems } = useInventory();

  const radarData = useMemo(() => {
    if (inventoryItems.length === 0) return null;

    // Detect Dead-Stock (Quantity > 2x Reorder point)
    const deadStockItems = inventoryItems.filter(
      (item) => item.quantity > item.reorderPoint * 2.5
    );

    const deadStockCapital = deadStockItems.reduce(
      (sum, item) => sum + item.unitCost * (item.quantity - item.reorderPoint * 2),
      0
    );

    // Detect Shrinkage & Leakage Anomalies (High cost vs sell price margin discrepancies)
    const shrinkageRisks = inventoryItems.filter(
      (item) => item.sellPrice <= item.unitCost * 1.05 || item.quantity === 0
    );

    const potentialLiquidationValue = deadStockCapital * 0.75; // 25% discount strategy

    return {
      deadStockItems,
      deadStockCapital,
      potentialLiquidationValue,
      shrinkageRisks,
    };
  }, [inventoryItems]);

  if (!radarData || (radarData.deadStockItems.length === 0 && radarData.shrinkageRisks.length === 0)) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-foreground font-semibold text-base">
        <Flame className="w-5 h-5 text-amber-500" />
        Capital Liquidation &amp; Inventory Shrinkage Radar
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dead Stock Liquidation Radar */}
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-amber-600 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Flame className="w-4 h-4" /> Dead-Stock Liquidation Radar
              </span>
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-0">
                {radarData.deadStockItems.length} SKUs Identified
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between items-center bg-background/80 p-2.5 rounded border border-amber-500/20">
              <span className="text-muted-foreground">Locked Capital in Slow Stock:</span>
              <span className="font-bold text-amber-600">{formatCurrency(radarData.deadStockCapital)}</span>
            </div>

            <div className="space-y-1.5">
              <span className="font-semibold text-muted-foreground block text-[11px]">Recommended Liquidation Bundles:</span>
              {radarData.deadStockItems.slice(0, 2).map((item) => (
                <div key={item.id} className="flex justify-between items-center bg-background p-2 rounded border border-border/40">
                  <span className="font-medium text-foreground truncate max-w-[180px]">{item.name}</span>
                  <span className="text-amber-600 font-semibold">25% Bundle Discount</span>
                </div>
              ))}
            </div>

            <div className="pt-1 flex justify-between items-center text-amber-700 font-medium">
              <span>Potential Capital Recovered:</span>
              <span className="font-bold text-sm">{formatCurrency(radarData.potentialLiquidationValue)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Shrinkage & Leakage Radar */}
        <Card className="border-rose-500/30 bg-rose-500/5 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-rose-600 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" /> Shrinkage &amp; Profit Leakage Alert
              </span>
              <Badge variant="secondary" className="bg-rose-100 text-rose-700 border-0">
                {radarData.shrinkageRisks.length} Risk Items
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between items-center bg-background/80 p-2.5 rounded border border-rose-500/20">
              <span className="text-muted-foreground">Detected Margin Discrepancies:</span>
              <span className="font-bold text-rose-600">Zero / Low Margin</span>
            </div>

            <div className="space-y-1.5">
              <span className="font-semibold text-muted-foreground block text-[11px]">Flagged Products:</span>
              {radarData.shrinkageRisks.slice(0, 2).map((item) => (
                <div key={item.id} className="flex justify-between items-center bg-background p-2 rounded border border-border/40">
                  <span className="font-medium text-foreground truncate max-w-[180px]">{item.name}</span>
                  <span className="text-rose-600 font-semibold">{item.quantity === 0 ? "Stockout Leakage" : "Negative Margin"}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-rose-600/80 italic pt-1">
              AI recommendation: Audit physical counts against transaction receipts to resolve leakage.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
