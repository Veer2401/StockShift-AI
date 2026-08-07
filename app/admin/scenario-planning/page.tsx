"use client";

import { useState, useMemo } from "react";
import { useInventory } from "@/_lib/inventory-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/_components/ui/card";
import { Button } from "@/_components/ui/button";
import { Badge } from "@/_components/ui/badge";
import { Slider } from "@/_components/ui/slider";
import { Target, TrendingUp, TrendingDown, Zap, ArrowRight, Package, Plus } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/_lib/utils";

export default function ScenarioPlanningPage() {
  const { items: inventoryItems, isLoading } = useInventory();

  const [demandModifier, setDemandModifier] = useState(1.0);
  const [leadTimeModifier, setLeadTimeModifier] = useState(1.0);
  const [safetyStockModifier, setSafetyStockModifier] = useState(1.0);

  // Compute what-if scenario results dynamically over user's live database items
  const scenarioResults = useMemo(() => {
    if (inventoryItems.length === 0) return null;

    let stockoutsPrevented = 0;
    let newStockoutRisks = 0;
    let totalCapitalChange = 0;

    const skuProjections = inventoryItems.map((item) => {
      const currentDailyDemand = Math.max(1, Math.round(item.reorderPoint / 15));
      const projectedDailyDemand = currentDailyDemand * demandModifier;

      const currentDaysUntilStockout = Math.floor(item.quantity / currentDailyDemand);
      const projectedDaysUntilStockout = Math.floor(item.quantity / (projectedDailyDemand || 1));

      const currentReorderPoint = item.reorderPoint;
      const projectedReorderPoint = Math.ceil(
        item.reorderPoint * leadTimeModifier * safetyStockModifier
      );

      const isCurrentStockout = currentDaysUntilStockout <= 7;
      const isProjectedStockout = projectedDaysUntilStockout <= 7;

      let impact: "positive" | "negative" | "neutral" = "neutral";
      let actionNeeded = "";

      if (isCurrentStockout && !isProjectedStockout) {
        stockoutsPrevented++;
        impact = "positive";
        actionNeeded = "Current buffer is sufficient to prevent stockout under this scenario.";
      } else if (!isCurrentStockout && isProjectedStockout) {
        newStockoutRisks++;
        impact = "negative";
        actionNeeded = `Increased demand creates stockout risk in ~${projectedDaysUntilStockout} days. Reorder ${Math.ceil(projectedReorderPoint * 1.5)} units soon.`;
      } else if (projectedDaysUntilStockout < currentDaysUntilStockout) {
        impact = "negative";
        actionNeeded = `Monitor stock closely. Stockout runway shortened to ${projectedDaysUntilStockout} days.`;
      } else {
        impact = "neutral";
        actionNeeded = "Stock levels remain stable under current scenario modifiers.";
      }

      const capitalDiff = (projectedReorderPoint - currentReorderPoint) * item.unitCost;
      totalCapitalChange += capitalDiff;

      return {
        sku: item.sku,
        name: item.name,
        current: {
          avg_daily_demand: currentDailyDemand,
          days_until_stockout: currentDaysUntilStockout,
          reorder_point: currentReorderPoint,
        },
        projected: {
          avg_daily_demand: projectedDailyDemand,
          days_until_stockout: projectedDaysUntilStockout,
          reorder_point: projectedReorderPoint,
        },
        impact,
        action_needed: actionNeeded,
      };
    });

    return {
      overall_impact: {
        stockouts_prevented: stockoutsPrevented,
        new_stockout_risks: newStockoutRisks,
        capital_change: totalCapitalChange,
      },
      skus: skuProjections,
    };
  }, [inventoryItems, demandModifier, leadTimeModifier, safetyStockModifier]);

  const reset = () => {
    setDemandModifier(1.0);
    setLeadTimeModifier(1.0);
    setSafetyStockModifier(1.0);
  };

  const formatPercent = (val: number) => {
    const pct = (val - 1) * 100;
    const pctStr = pct.toFixed(0);
    return pctStr === "0" ? "Baseline" : `${pct > 0 ? "+" : ""}${pctStr}%`;
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground text-sm">Loading scenario planning module...</p>
      </div>
    );
  }

  if (inventoryItems.length === 0 || !scenarioResults) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <Target className="w-7 h-7 text-emerald-600" />
            Scenario Planning &amp; Simulation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Simulate "what-if" demand surges, lead time delays, and safety stock changes.
          </p>
        </div>

        <Card className="border-2 border-dashed border-emerald-500/30 bg-card/60 p-8 text-center shadow-none">
          <div className="mx-auto flex max-w-md flex-col items-center justify-center space-y-3">
            <div className="rounded-full bg-emerald-500/10 p-4 text-emerald-600">
              <Package className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground">No Inventory Items Available</h3>
            <p className="text-sm text-muted-foreground">
              Add products to your inventory database to test demand surges and lead time scenarios.
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
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground sm:text-3xl">
          <Target className="w-8 h-8 text-emerald-600" />
          Scenario Planning
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Run "what-if" scenarios to simulate demand spikes and lead-time delays on your inventory.
        </p>
      </div>

      {/* Controls */}
      <Card className="border-border/60 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Zap className="w-5 h-5 text-emerald-600" />
            Scenario Parameters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Demand Modifier */}
          <div>
            <div className="flex justify-between mb-1.5 text-sm">
              <label className="font-medium text-foreground">Demand Modifier</label>
              <span className="font-semibold text-emerald-600">{formatPercent(demandModifier)}</span>
            </div>
            <Slider
              value={[demandModifier]}
              onValueChange={([val]) => setDemandModifier(val)}
              min={0.5}
              max={2.0}
              step={0.1}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>-50% (Slump)</span>
              <span>Baseline</span>
              <span>+100% (Surge)</span>
            </div>
          </div>

          {/* Lead Time Modifier */}
          <div>
            <div className="flex justify-between mb-1.5 text-sm">
              <label className="font-medium text-foreground">Supplier Lead Time Modifier</label>
              <span className="font-semibold text-emerald-600">{formatPercent(leadTimeModifier)}</span>
            </div>
            <Slider
              value={[leadTimeModifier]}
              onValueChange={([val]) => setLeadTimeModifier(val)}
              min={0.5}
              max={2.0}
              step={0.1}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>-50% (Faster)</span>
              <span>Baseline</span>
              <span>+100% (Supplier Delay)</span>
            </div>
          </div>

          {/* Safety Stock Modifier */}
          <div>
            <div className="flex justify-between mb-1.5 text-sm">
              <label className="font-medium text-foreground">Safety Stock Buffer Target</label>
              <span className="font-semibold text-emerald-600">{formatPercent(safetyStockModifier)}</span>
            </div>
            <Slider
              value={[safetyStockModifier]}
              onValueChange={([val]) => setSafetyStockModifier(val)}
              min={0.5}
              max={2.0}
              step={0.1}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>-50% (Lean Buffer)</span>
              <span>Baseline</span>
              <span>+100% (Heavy Buffer)</span>
            </div>
          </div>

          {/* Reset */}
          <div className="flex justify-end pt-2">
            <Button onClick={reset} variant="outline" size="sm">
              Reset Modifiers to Baseline
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Overall Impact */}
      <Card className="border-border/60 shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Scenario Impact Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
              <div className="text-3xl font-bold text-emerald-600">
                {scenarioResults.overall_impact.stockouts_prevented}
              </div>
              <p className="text-xs text-emerald-600 font-medium mt-1">Stockouts Prevented</p>
            </div>
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-center">
              <div className="text-3xl font-bold text-rose-600">
                {scenarioResults.overall_impact.new_stockout_risks}
              </div>
              <p className="text-xs text-rose-600 font-medium mt-1">New Stockout Risks</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/40 border border-border/60 text-center">
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(scenarioResults.overall_impact.capital_change)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Projected Working Capital Shift</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SKU-Level Results */}
      <Card className="border-border/60 shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Product Projections under Current Scenario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {scenarioResults.skus.map((sku) => (
              <div
                key={sku.sku}
                className="p-4 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">{sku.name}</h3>
                    <p className="text-xs text-muted-foreground">SKU: {sku.sku}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      sku.impact === "positive"
                        ? "bg-emerald-50 text-emerald-600 border-0"
                        : sku.impact === "negative"
                        ? "bg-rose-50 text-rose-600 border-0"
                        : "bg-slate-100 text-slate-600 border-0"
                    }
                  >
                    {sku.impact === "positive" ? (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Improved
                      </span>
                    ) : sku.impact === "negative" ? (
                      <span className="flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" /> Higher Risk
                      </span>
                    ) : (
                      "Stable"
                    )}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-1">Projected Daily Demand</p>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{sku.current.avg_daily_demand} u/day</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="font-bold text-foreground">
                        {sku.projected.avg_daily_demand.toFixed(1)} u/day
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Stockout Runway</p>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{sku.current.days_until_stockout} days</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="font-bold text-foreground">
                        {sku.projected.days_until_stockout} days
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Recommended Reorder Point</p>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{sku.current.reorder_point}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="font-bold text-emerald-600">
                        {sku.projected.reorder_point}
                      </span>
                    </div>
                  </div>
                </div>

                {sku.action_needed && (
                  <div className="mt-3 p-2.5 bg-background border border-border/60 rounded text-xs">
                    <span className="font-semibold text-foreground">📋 Recommendation: </span>
                    <span className="text-muted-foreground">{sku.action_needed}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
