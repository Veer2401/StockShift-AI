"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { useAuth } from "@/_lib/auth-context";
import { useInventory } from "@/_lib/inventory-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/_components/ui/card";
import { Button } from "@/_components/ui/button";
import { Input } from "@/_components/ui/input";
import { Label } from "@/_components/ui/label";
import { Badge } from "@/_components/ui/badge";
import {
  ScanBarcode,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Check,
  AlertTriangle,
  Loader2,
  Search,
  Package,
  X,
} from "lucide-react";
import type { InventoryItem } from "@/_lib/types";

interface CartItem {
  item: InventoryItem;
  quantity: number;
}

export default function PosTerminalPage() {
  const { user } = useAuth();
  const { items, refreshData } = useInventory();

  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<any>(null);
  const [error, setError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Filter items based on search (by SKU or name)
  const filteredItems = searchQuery.trim()
    ? items.filter(
        (i) =>
          i.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const addToCart = (item: InventoryItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
    setSearchQuery("");
    searchRef.current?.focus();
  };

  const updateQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.item.id === itemId
            ? { ...c, quantity: Math.max(0, c.quantity + delta) }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.item.id !== itemId));
  };

  const cartTotal = cart.reduce(
    (sum, c) => sum + c.item.sellPrice * c.quantity,
    0
  );
  const cartItemsCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0 || !user) return;
    setIsProcessing(true);
    setError("");
    setCheckoutResult(null);

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_AI_BACKEND_URL || "http://localhost:5001";
      const res = await fetch(`${backendUrl}/api/v1/pos/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          items: cart.map((c) => ({
            sku: c.item.sku,
            quantity: c.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCheckoutResult(data);
        setCart([]);
        // Refresh the inventory context to reflect updated quantities
        await refreshData();
      } else {
        setError(data.error || "Checkout failed.");
      }
    } catch {
      setError("Could not connect to the server. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto-focus search on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className="flex flex-col lg:flex-row h-full gap-4 overflow-hidden"
    >
      {/* LEFT: Search & Item Picker */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2.5 text-foreground sm:text-2xl tracking-tight">
            <ScanBarcode className="w-7 h-7 text-emerald-600" />
            POS Terminal
          </h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            Search by SKU or product name, add items to cart, and process sales in real-time.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative flex items-center rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/80 dark:border-white/15 shadow-sm hover:shadow-md focus-within:shadow-lg focus-within:ring-2 focus-within:ring-emerald-500/40 focus-within:border-emerald-500/60 transition-all duration-200 p-1.5">
          <div className="flex items-center justify-center p-2 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0 ml-1">
            <Search className="h-4 w-4" />
          </div>
          <Input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Scan barcode, SKU code (e.g. DRY-001) or product name..."
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 text-sm font-medium placeholder:text-muted-foreground/60 pr-16"
          />
          <div className="absolute right-3 flex items-center gap-1.5">
            {searchQuery ? (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setSearchQuery("")}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground active:scale-95"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <Badge variant="outline" className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-muted-foreground/70 bg-black/5 dark:bg-white/5 border-black/10 px-2 py-0.5 rounded-lg select-none">
                <ScanBarcode className="w-3 h-3 text-emerald-600" /> READY
              </Badge>
            )}
          </div>
        </div>

        {/* Search results */}
        {filteredItems.length > 0 && (
          <div className="border border-white/80 dark:border-white/10 rounded-2xl divide-y divide-black/5 dark:divide-white/10 max-h-[calc(100vh-320px)] overflow-y-auto bg-white/85 dark:bg-zinc-900/85 backdrop-blur-2xl shadow-lg">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => addToCart(item)}
                className="flex items-center justify-between w-full px-4 py-3.5 text-left hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15 transition-all duration-150 cursor-pointer active:scale-[0.99] group select-none"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground truncate tracking-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      {item.name}
                    </p>
                    <Badge variant="secondary" className="font-mono text-[10px] font-bold px-1.5 py-0 rounded-md bg-black/5 dark:bg-white/10 text-foreground border-0">
                      {item.sku}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                    <span>{item.category}</span>
                    <span>·</span>
                    <span className={item.quantity <= item.reorderPoint ? "text-amber-600 font-semibold" : "text-emerald-600 font-semibold"}>
                      {item.quantity} in stock
                    </span>
                    {item.location && (
                      <>
                        <span>·</span>
                        <span>{item.location}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <div className="text-right">
                    <p className="text-sm font-extrabold text-foreground tracking-tight">
                      ₹{item.sellPrice.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-medium">Cost: ₹{item.unitCost}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs group-hover:scale-110 transition-transform">
                    <Plus className="h-4 w-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {searchQuery.trim() && filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border border-dashed border-black/10 dark:border-white/10 rounded-2xl p-6 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md">
            <Package className="h-10 w-10 mb-2 text-muted-foreground/40 animate-bounce" />
            <p className="text-sm font-semibold text-foreground">No inventory items matched &ldquo;{searchQuery}&rdquo;</p>
            <p className="text-xs text-muted-foreground mt-1">Try searching by SKU code (e.g. DRY-001) or product name</p>
          </div>
        )}

        {/* Checkout result */}
        {checkoutResult && (
          <Card className="border-emerald-200 bg-emerald-50/40 shadow-none">
            <CardContent className="py-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                <Check className="h-4 w-4" />
                Sale processed successfully
              </div>
              {checkoutResult.results?.map((r: any, i: number) => (
                <p key={i} className="text-xs text-emerald-700">
                  {r.name}: {r.quantitySold} sold · {r.remainingStock} remaining
                </p>
              ))}
              {checkoutResult.lowStockAlerts?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-emerald-200/60">
                  <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Low stock alerts
                  </p>
                  {checkoutResult.lowStockAlerts.map((a: any, i: number) => (
                    <p key={i} className="text-xs text-amber-600">
                      {a.name} ({a.sku}): {a.remainingStock} left (reorder point: {a.reorderPoint})
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* RIGHT: Cart */}
      <div className="w-80 flex flex-col border border-border/60 rounded-2xl bg-card overflow-hidden shrink-0">
        {/* Cart header */}
        <div className="px-4 py-3 border-b border-border/40 bg-muted/20">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-emerald-600" />
            Cart
            {cartItemsCount > 0 && (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-0 ml-auto text-xs">
                {cartItemsCount} items
              </Badge>
            )}
          </h2>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
              <ShoppingCart className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">Cart is empty</p>
              <p className="text-xs">Search & add items above</p>
            </div>
          ) : (
            cart.map((c) => (
              <div key={c.item.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {c.item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.item.sku}</p>
                  </div>
                  <button
                    onClick={() => removeFromCart(c.item.id)}
                    className="text-rose-400 hover:text-rose-600 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQty(c.item.id, -1)}
                      className="h-6 w-6 rounded-md border border-border/60 flex items-center justify-center hover:bg-muted/60 transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center text-xs font-bold">
                      {c.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(c.item.id, 1)}
                      className="h-6 w-6 rounded-md border border-border/60 flex items-center justify-center hover:bg-muted/60 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-xs font-bold text-foreground">
                    ₹{(c.item.sellPrice * c.quantity).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart footer */}
        <div className="border-t border-border/40 p-4 space-y-3 bg-muted/10">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <span className="text-lg font-bold text-foreground">
              ₹{cartTotal.toLocaleString()}
            </span>
          </div>
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
          <Button
            onClick={handleCheckout}
            disabled={cart.length === 0 || isProcessing}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-5"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" /> Process Sale
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
