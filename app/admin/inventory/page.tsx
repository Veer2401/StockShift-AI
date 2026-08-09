"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { useInventory } from "@/_lib/inventory-context";
import { CATEGORIES, LOCATIONS } from "@/_lib/mock-data";
import { formatCurrency, cn } from "@/_lib/utils";
import type { InventoryItem } from "@/_lib/types";
import { Button } from "@/_components/ui/button";
import { Input } from "@/_components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/_components/ui/card";
import { Badge } from "@/_components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/_components/ui/dialog";
import { Label } from "@/_components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/_components/ui/select";
import { Textarea } from "@/_components/ui/textarea";
import { Separator } from "@/_components/ui/separator";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Package,
  Brain,
  RefreshCw,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { getInsights, type AIRecommendation } from "@/_lib/ai-service";
import { CsvImporterModal } from "./components/CsvImporterModal";

type SortKey =
  | "name"
  | "sku"
  | "category"
  | "quantity"
  | "unitCost"
  | "totalValue"
  | "status";
type SortDir = "asc" | "desc";

const ITEMS_PER_PAGE = 8;

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

const emptyForm = {
  name: "",
  sku: "",
  category: "",
  quantity: 0,
  unitCost: 0,
  sellPrice: 0,
  reorderPoint: 0,
  location: "",
  description: "",
};

function getStatus(item: InventoryItem) {
  if (item.quantity === 0) return "Out of Stock";
  if (item.quantity <= item.reorderPoint) return "Low Stock";
  return "In Stock";
}

function getStatusVariant(status: string) {
  if (status === "Out of Stock") return "destructive" as const;
  if (status === "Low Stock") return "warning" as const;
  return "success" as const;
}

export default function InventoryPage() {
  const { items, addItem, updateItem, deleteItem, refreshData } = useInventory();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  /* AI recommendations state */
  const [aiRecs, setAiRecs] = useState<AIRecommendation[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchAiRecs = useCallback(async () => {
    setAiLoading(true);
    try {
      const data = await getInsights();
      setAiRecs(data.recommendations || []);
    } catch {
      // silently fail — AI badges are optional
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAiRecs();
  }, [fetchAiRecs]);

  /** Map SKU → AI recommendation for quick lookup */
  const aiBySkuMap = useMemo(() => {
    const map = new Map<string, AIRecommendation>();
    aiRecs.forEach((rec) => map.set(rec.sku, rec));
    return map;
  }, [aiRecs]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(items.map((i) => i.category));
    return Array.from(cats).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q);
      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [items, search, categoryFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return dir * a.name.localeCompare(b.name);
        case "sku":
          return dir * a.sku.localeCompare(b.sku);
        case "category":
          return dir * a.category.localeCompare(b.category);
        case "quantity":
          return dir * (a.quantity - b.quantity);
        case "unitCost":
          return dir * (a.unitCost - b.unitCost);
        case "totalValue":
          return (
            dir * (a.quantity * a.unitCost - b.quantity * b.unitCost)
          );
        case "status": {
          const order = { "Out of Stock": 0, "Low Stock": 1, "In Stock": 2 };
          return (
            dir *
            (order[getStatus(a) as keyof typeof order] -
              order[getStatus(b) as keyof typeof order])
          );
        }
        default:
          return 0;
      }
    });

    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function openAddDialog() {
    setEditingItem(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEditDialog(item: InventoryItem) {
    setEditingItem(item);
    setForm({
      name: item.name,
      sku: item.sku,
      category: item.category,
      quantity: item.quantity,
      unitCost: item.unitCost,
      sellPrice: item.sellPrice,
      reorderPoint: item.reorderPoint,
      location: item.location,
      description: item.description ?? "",
    });
    setFormOpen(true);
  }

  function openDeleteDialog(item: InventoryItem) {
    setDeletingItem(item);
    setDeleteOpen(true);
  }

  function handleSave() {
    const data = {
      name: form.name,
      sku: form.sku,
      category: form.category,
      quantity: Number(form.quantity),
      unitCost: Number(form.unitCost),
      sellPrice: Number(form.sellPrice),
      reorderPoint: Number(form.reorderPoint),
      location: form.location,
      description: form.description || undefined,
    };

    if (editingItem) {
      updateItem(editingItem.id, data);
    } else {
      addItem(data);
    }

    setFormOpen(false);
    setEditingItem(null);
    setForm(emptyForm);
  }

  function handleDelete() {
    if (deletingItem) {
      deleteItem(deletingItem.id);
    }
    setDeleteOpen(false);
    setDeletingItem(null);
  }

  const canSave =
    form.name.trim() !== "" &&
    form.sku.trim() !== "" &&
    form.category !== "" &&
    form.location !== "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3 flex-wrap">
        <div className="rounded-2xl bg-white/80 dark:bg-zinc-800/80 p-2.5 sm:p-3 shadow-2xs backdrop-blur-md border border-white/60">
          <Package className="h-5 w-5 sm:h-6 sm:w-6 text-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground font-medium">
            Manage your stock items, quantities, and details.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-1 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or SKU..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
          <Select
            value={categoryFilter}
            onValueChange={(v) => {
              setCategoryFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px] rounded-xl bg-background/70 backdrop-blur-md">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-white/60">
              <SelectItem value="all">All Categories</SelectItem>
              {uniqueCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsCsvModalOpen(true)} className="rounded-xl active:scale-95 font-semibold">
            <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />
            Import CSV
          </Button>
          <Button onClick={openAddDialog} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl active:scale-95 shadow-md shadow-emerald-600/20">
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
      </div>

      <CsvImporterModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onSuccess={() => {
          refreshData();
        }}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
            {sorted.length} item{sorted.length !== 1 ? "s" : ""} found
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 dark:border-white/10 bg-black/2 dark:bg-white/2">
                  {(
                    [
                      ["name", "Name"],
                      ["sku", "SKU"],
                      ["category", "Category"],
                      ["quantity", "Qty"],
                      ["unitCost", "Unit Cost"],
                      ["totalValue", "Total Value"],
                      ["status", "Status"],
                    ] as [SortKey, string][]
                  ).map(([key, label]) => (
                    <th key={key} className="px-4 py-3 text-left font-semibold text-xs tracking-tight text-muted-foreground">
                      <button
                        onClick={() => handleSort(key)}
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors active:scale-95"
                      >
                        {label}
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left font-semibold text-xs tracking-tight text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Brain className="h-3.5 w-3.5 text-emerald-600" />
                      AI
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-xs tracking-tight text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      No items found.
                    </td>
                  </tr>
                ) : (
                  paginated.map((item) => {
                    const status = getStatus(item);
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-black/5 dark:border-white/10 last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-150 active:scale-[0.999]"
                      >
                        <td className="px-4 py-3.5 font-semibold text-foreground tracking-tight">{item.name}</td>
                        <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs">
                          {item.sku}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground font-medium">{item.category}</td>
                        <td className="px-4 py-3.5 tabular-nums font-semibold">
                          {item.quantity.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 tabular-nums font-medium">
                          {formatCurrency(item.unitCost)}
                        </td>
                        <td className="px-4 py-3.5 tabular-nums font-semibold text-foreground">
                          {formatCurrency(item.quantity * item.unitCost)}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant={getStatusVariant(status)} className="rounded-lg font-semibold px-2 py-0.5">
                            {status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          {(() => {
                            const rec = aiBySkuMap.get(item.sku);
                            if (aiLoading) return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
                            if (!rec) return <span className="text-xs text-muted-foreground">—</span>;
                            const colors = {
                              critical: "bg-red-100 text-red-700 border-red-200",
                              high: "bg-orange-100 text-orange-700 border-orange-200",
                              medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
                              low: "bg-emerald-100 text-emerald-700 border-emerald-200",
                            };
                            return (
                              <Badge
                                variant="secondary"
                                className={cn("text-[10px] px-1.5 py-0.5 border rounded-md font-semibold cursor-help shadow-2xs", colors[rec.urgency] || colors.low)}
                                title={rec.description}
                              >
                                {rec.type === "reorder" ? "⚡ Reorder" : rec.type === "anomaly" ? "⚠️ Anomaly" : "📦 Overstock"}
                              </Badge>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg active:scale-95"
                              onClick={() => openEditDialog(item)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg active:scale-95"
                              onClick={() => openDeleteDialog(item)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <>
              <Separator />
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Item" : "Add New Item"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Update the details of this inventory item."
                : "Fill in the details to add a new inventory item."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Existing SKU Dropdown Selector */}
            {items.length > 0 && !editingItem && (
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
                    const matched = items.find((i) => i.sku === selectedSku);
                    if (matched) {
                      setForm({
                        name: matched.name,
                        sku: matched.sku,
                        category: matched.category,
                        quantity: matched.quantity,
                        unitCost: matched.unitCost,
                        sellPrice: matched.sellPrice,
                        reorderPoint: matched.reorderPoint,
                        location: matched.location,
                        description: matched.description || "",
                      });
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
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.sku} className="text-xs">
                        <span className="font-mono font-bold text-foreground">{item.sku}</span> — {item.name} ({item.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="item-name">Name</Label>
                <Input
                  id="item-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Item name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-sku">SKU Code</Label>
                <Input
                  id="item-sku"
                  value={form.sku}
                  onChange={(e) => {
                    const newSku = e.target.value;
                    setForm((f) => ({ ...f, sku: newSku }));
                    if (!editingItem && newSku.trim()) {
                      const matched = items.find((i) => i.sku.toLowerCase() === newSku.trim().toLowerCase());
                      if (matched) {
                        setForm((f) => ({
                          ...f,
                          name: matched.name,
                          category: matched.category,
                          unitCost: matched.unitCost,
                          sellPrice: matched.sellPrice,
                          reorderPoint: matched.reorderPoint,
                          location: matched.location,
                          description: matched.description || "",
                        }));
                      }
                    }
                  }}
                  placeholder="e.g. ELEC-PCB-001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category / Sector</Label>
              <Select
                value={form.category}
                onValueChange={(v) => {
                  setForm((f) => {
                    const generated = (!editingItem && (!f.sku || f.sku.trim() === "")) ? getSectorSku(v, items) : f.sku;
                    return { ...f, category: v, sku: generated };
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="item-qty">Quantity</Label>
                <Input
                  id="item-qty"
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      quantity: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-cost">Unit Cost</Label>
                <Input
                  id="item-cost"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.unitCost}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      unitCost: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-sell">Sell Price</Label>
                <Input
                  id="item-sell"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.sellPrice}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sellPrice: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="item-reorder">Reorder Point</Label>
                <Input
                  id="item-reorder"
                  type="number"
                  min={0}
                  value={form.reorderPoint}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      reorderPoint: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Select
                  value={form.location}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, location: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-desc">Description (optional)</Label>
              <Textarea
                id="item-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Brief description of the item"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              {editingItem ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {deletingItem?.name}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
