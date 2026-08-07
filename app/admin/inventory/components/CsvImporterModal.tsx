"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/_components/ui/dialog";
import { Button } from "@/_components/ui/button";
import { Badge } from "@/_components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowRight, Table } from "lucide-react";
import { getSupabaseClient } from "@/_lib/supabase/client";
import { useAuth } from "@/_lib/auth-context";

interface CsvImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CsvImporterModal({ isOpen, onClose, onSuccess }: CsvImporterModalProps) {
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const [step, setStep] = useState<"upload" | "map" | "preview">("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Column Mappings State (Default AI Best Match)
  const [mapping, setMapping] = useState<Record<string, string>>({
    name: "",
    sku: "",
    category: "",
    quantity: "",
    unitCost: "",
    sellPrice: "",
    reorderPoint: "",
    location: "",
  });

  const parseCsvText = (text: string) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) return;

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const rows = lines.slice(1).map((line) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));

    setCsvHeaders(headers);
    setCsvRows(rows);

    // AI Smart Column Auto-Matching
    const autoMap: Record<string, string> = {
      name: findBestHeaderMatch(headers, ["name", "title", "product", "item_name", "description"]),
      sku: findBestHeaderMatch(headers, ["sku", "code", "item_code", "sku_code", "model"]),
      category: findBestHeaderMatch(headers, ["category", "dept", "department", "type"]),
      quantity: findBestHeaderMatch(headers, ["qty", "quantity", "stock", "count", "units"]),
      unitCost: findBestHeaderMatch(headers, ["cost", "unit_cost", "buy_price", "purchase_cost"]),
      sellPrice: findBestHeaderMatch(headers, ["price", "sell_price", "retail_price", "msrp"]),
      reorderPoint: findBestHeaderMatch(headers, ["reorder", "reorder_point", "min_stock", "safety_stock"]),
      location: findBestHeaderMatch(headers, ["location", "warehouse", "shelf", "bin"]),
    };

    setMapping(autoMap);
    setStep("map");
  };

  const findBestHeaderMatch = (headers: string[], candidates: string[]): string => {
    for (const cand of candidates) {
      const match = headers.find((h) => h.toLowerCase().includes(cand));
      if (match) return match;
    }
    return headers[0] || "";
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        parseCsvText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleImportBatch = async () => {
    if (!user) return;
    setIsImporting(true);
    setErrorMessage(null);

    try {
      const getVal = (row: string[], headerName: string) => {
        const idx = csvHeaders.indexOf(headerName);
        return idx !== -1 ? row[idx] : "";
      };

      const dbPayloads = csvRows.map((row, idx) => {
        const name = getVal(row, mapping.name) || `Imported Item ${idx + 1}`;
        const sku = getVal(row, mapping.sku) || `SKU-${Date.now().toString().slice(-4)}-${idx + 1}`;
        const category = getVal(row, mapping.category) || "General";
        const quantity = Math.max(0, parseInt(getVal(row, mapping.quantity)) || 10);
        const unitCost = Math.max(0, parseFloat(getVal(row, mapping.unitCost)) || 50);
        const sellPrice = Math.max(0, parseFloat(getVal(row, mapping.sellPrice)) || unitCost * 1.4);
        const reorderPoint = Math.max(0, parseInt(getVal(row, mapping.reorderPoint)) || 5);
        const location = getVal(row, mapping.location) || "Main Warehouse";

        return {
          user_id: user.id,
          name,
          sku,
          category,
          quantity,
          unit_cost: unitCost,
          sell_price: sellPrice,
          reorder_point: reorderPoint,
          location,
          description: "Bulk imported via AI Smart CSV Importer.",
        };
      });

      const { error } = await supabase.from("inventory_items").insert(dbPayloads);
      if (error) {
        throw error;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to import items into database.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            AI Smart CSV / Excel Inventory Importer
          </DialogTitle>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="py-8 border-2 border-dashed border-emerald-500/30 rounded-xl bg-card/60 text-center space-y-4">
            <div className="mx-auto flex max-w-md flex-col items-center justify-center space-y-3">
              <div className="rounded-full bg-emerald-500/10 p-4 text-emerald-600">
                <Upload className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Upload Supplier Inventory CSV</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Drag and drop your product catalog or supplier CSV file. Our AI engine automatically maps column headers to your database schema.
              </p>
              <label className="cursor-pointer">
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                <Button variant="outline" className="bg-emerald-600 hover:bg-emerald-500 text-white border-0 font-medium">
                  Select CSV File
                </Button>
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Smart Column Mapping */}
        {step === "map" && (
          <div className="space-y-4 py-2 text-xs">
            <div className="flex items-center justify-between p-3 bg-emerald-50 text-emerald-800 rounded-lg">
              <span className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                AI Auto-Mapped Columns ({csvRows.length} rows detected)
              </span>
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                Auto-Matched
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
              {[
                { field: "name", label: "Product Name *" },
                { field: "sku", label: "SKU / Item Code *" },
                { field: "category", label: "Category" },
                { field: "quantity", label: "Quantity (Stock)" },
                { field: "unitCost", label: "Unit Cost (₹)" },
                { field: "sellPrice", label: "Selling Price (₹)" },
                { field: "reorderPoint", label: "Reorder Point" },
                { field: "location", label: "Warehouse Location" },
              ].map(({ field, label }) => (
                <div key={field} className="space-y-1 bg-muted/20 p-2.5 rounded border border-border/40">
                  <label className="font-semibold text-foreground block">{label}</label>
                  <select
                    value={mapping[field] || ""}
                    onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                    className="w-full h-8 px-2 rounded border border-input bg-background text-xs"
                  >
                    <option value="">-- Unmapped --</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="pt-2">
          {step === "upload" ? (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          ) : (
            <div className="flex gap-2 w-full justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Choose Different File
              </Button>
              <Button
                onClick={handleImportBatch}
                disabled={isImporting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              >
                {isImporting ? "Importing to Database..." : `Import ${csvRows.length} Items to Supabase`}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
