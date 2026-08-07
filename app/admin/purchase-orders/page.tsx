"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/_lib/auth-context";
import { useInventory } from "@/_lib/inventory-context";
import { getSupabaseClient } from "@/_lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/_components/ui/card";
import { Button } from "@/_components/ui/button";
import { Badge } from "@/_components/ui/badge";
import { Input } from "@/_components/ui/input";
import { Label } from "@/_components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/_components/ui/dialog";
import { FileText, Plus, Download, Mail, CheckCircle2, Clock, Trash2, Send, Sparkles, Building2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/_lib/utils";
import type { PurchaseOrder, Vendor } from "@/_lib/types";

export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const { items: inventoryItems } = useInventory();
  const supabase = getSupabaseClient();

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New PO Form State
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [poQuantity, setPoQuantity] = useState(50);
  const [poNotes, setPoNotes] = useState("");

  const fetchPurchaseOrdersAndVendors = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [poRes, vendorRes] = await Promise.all([
        supabase.from("purchase_orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("vendors").select("*").eq("user_id", user.id),
      ]);

      if (poRes.data) {
        setPurchaseOrders(
          poRes.data.map((row) => ({
            id: row.id,
            poNumber: row.po_number,
            vendorId: row.vendor_id,
            vendorName: row.vendor_name,
            status: row.status as any,
            totalAmount: Number(row.total_amount || 0),
            items: row.items || [],
            notes: row.notes || "",
            createdAt: row.created_at,
          }))
        );
      }

      if (vendorRes.data) {
        setVendors(
          vendorRes.data.map((v) => ({
            id: v.id,
            name: v.name,
            email: v.email,
            leadTimeDays: v.lead_time_days || 7,
            minOrderQty: v.min_order_qty || 10,
          }))
        );
      }
    } catch (err) {
      console.error("Error loading purchase orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchaseOrdersAndVendors();
  }, [user]);

  const handleOpenAddModal = () => {
    if (vendors.length > 0) {
      setSelectedVendorId(vendors[0].id);
      setVendorName(vendors[0].name);
    } else {
      setSelectedVendorId("");
      setVendorName("");
    }

    if (inventoryItems.length > 0) {
      setSelectedItemId(inventoryItems[0].id);
    } else {
      setSelectedItemId("");
    }
    setPoQuantity(50);
    setPoNotes("Automated reorder purchase order.");
    setIsModalOpen(true);
  };

  const handleCreatePO = async () => {
    if (!user) return;

    const targetItem = inventoryItems.find((i) => i.id === selectedItemId);
    const targetVendor = vendors.find((v) => v.id === selectedVendorId);

    const vName = targetVendor ? targetVendor.name : vendorName || "General Supplier";
    const itemCost = targetItem ? targetItem.unitCost : 100;
    const total = itemCost * poQuantity;

    const poNumber = `PO-${Date.now().toString().slice(-6)}`;

    const itemsPayload = targetItem
      ? [
          {
            itemId: targetItem.id,
            itemName: targetItem.name,
            sku: targetItem.sku,
            quantity: poQuantity,
            unitCost: targetItem.unitCost,
            total,
          },
        ]
      : [];

    const payload = {
      user_id: user.id,
      po_number: poNumber,
      vendor_id: targetVendor ? targetVendor.id : null,
      vendor_name: vName,
      status: "draft",
      total_amount: total,
      items: itemsPayload,
      notes: poNotes,
    };

    await supabase.from("purchase_orders").insert(payload);
    setIsModalOpen(false);
    fetchPurchaseOrdersAndVendors();
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    await supabase.from("purchase_orders").update({ status: newStatus }).eq("id", id);
    fetchPurchaseOrdersAndVendors();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this purchase order?")) return;
    await supabase.from("purchase_orders").delete().eq("id", id);
    fetchPurchaseOrdersAndVendors();
  };

  const handlePrintPDF = (po: PurchaseOrder) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${po.poNumber} - Purchase Order</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 40px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; border-b: 2px solid #10b981; padding-bottom: 20px; }
            .company { font-size: 24px; font-weight: bold; color: #10b981; }
            .po-title { font-size: 28px; font-weight: bold; text-align: right; }
            .meta { margin-top: 30px; display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin-top: 30px; }
            th { background: #f1f5f9; text-align: left; padding: 12px; border-bottom: 2px solid #cbd5e1; }
            td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
            .total { margin-top: 30px; text-align: right; font-size: 20px; font-weight: bold; }
            .footer { margin-top: 50px; font-size: 12px; color: #64748b; text-align: center; border-t: 1px solid #e2e8f0; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="company">${user?.companyName || "StockShift Business"}</div>
              <div>${user?.city ? `${user.city}, ${user.state}` : "StockShift Workspace"}</div>
            </div>
            <div>
              <div class="po-title">PURCHASE ORDER</div>
              <div>PO Number: <strong>${po.poNumber}</strong></div>
              <div>Date: ${formatDate(po.createdAt)}</div>
            </div>
          </div>

          <div class="meta">
            <div>
              <strong>VENDOR:</strong><br>
              ${po.vendorName}<br>
              Status: ${po.status.toUpperCase()}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item / Description</th>
                <th>SKU</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${po.items
                .map(
                  (item) => `
                <tr>
                  <td>${item.itemName}</td>
                  <td>${item.sku}</td>
                  <td>${item.quantity}</td>
                  <td>₹${item.unitCost.toLocaleString()}</td>
                  <td>₹${item.total.toLocaleString()}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <div class="total">
            Total Purchase Order Amount: ₹${po.totalAmount.toLocaleString()}
          </div>

          <div class="footer">
            Thank you for your business. Generated automatically by StockShiftAI Intelligence Engine.
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground sm:text-3xl">
            <FileText className="w-8 h-8 text-emerald-600" />
            Automated Purchase Orders (POs)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-draft reorder Purchase Orders, manage vendor approvals, and export official PDF orders.
          </p>
        </div>
        <Button onClick={handleOpenAddModal} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
          <Plus className="w-4 h-4 mr-2" /> Draft New Purchase Order
        </Button>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="p-12 text-center text-muted-foreground text-sm">
          Loading purchase order database...
        </div>
      ) : purchaseOrders.length === 0 ? (
        <Card className="border-2 border-dashed border-emerald-500/30 bg-card/60 p-8 text-center shadow-none">
          <div className="mx-auto flex max-w-md flex-col items-center justify-center space-y-3">
            <div className="rounded-full bg-emerald-500/10 p-4 text-emerald-600">
              <FileText className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground">No Purchase Orders Created Yet</h3>
            <p className="text-sm text-muted-foreground">
              Create your first Purchase Order to streamline stock replenishment and download formal PO PDFs for suppliers.
            </p>
            <Button onClick={handleOpenAddModal} className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
              <Plus className="h-4 w-4 mr-2" /> Draft Purchase Order
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {purchaseOrders.map((po) => (
            <Card key={po.id} className="border-border/60 shadow-none hover:border-border transition-colors">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border/60">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-foreground">{po.poNumber}</h3>
                        <Badge
                          variant="secondary"
                          className={
                            po.status === "received"
                              ? "bg-emerald-50 text-emerald-600 border-0"
                              : po.status === "sent"
                              ? "bg-blue-50 text-blue-600 border-0"
                              : po.status === "cancelled"
                              ? "bg-rose-50 text-rose-600 border-0"
                              : "bg-amber-50 text-amber-600 border-0"
                          }
                        >
                          {po.status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Supplier: <span className="font-semibold text-foreground">{po.vendorName}</span> • Created {formatDate(po.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handlePrintPDF(po)}>
                      <Download className="w-4 h-4 mr-1.5" /> Export PDF
                    </Button>
                    {po.status === "draft" && (
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-500 text-white"
                        onClick={() => handleStatusChange(po.id, "sent")}
                      >
                        <Send className="w-4 h-4 mr-1.5" /> Mark as Sent
                      </Button>
                    )}
                    {po.status === "sent" && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                        onClick={() => handleStatusChange(po.id, "received")}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> Mark Received
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500" onClick={() => handleDelete(po.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Items Summary Table */}
                <div className="mt-3 text-xs space-y-2">
                  {po.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-muted/20 p-2.5 rounded border border-border/40">
                      <div>
                        <span className="font-semibold text-foreground">{item.itemName}</span>
                        <span className="text-muted-foreground ml-2">SKU: {item.sku}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span>{item.quantity} units @ {formatCurrency(item.unitCost)}</span>
                        <span className="font-bold text-foreground">{formatCurrency(item.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex justify-between items-center pt-2 text-xs">
                  <span className="text-muted-foreground">{po.notes || "Automated stock replenishment."}</span>
                  <span className="text-sm font-bold text-foreground">
                    Total Order Value: <span className="text-emerald-600 font-extrabold">{formatCurrency(po.totalAmount)}</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New PO Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Draft New Purchase Order</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-3 text-sm">
            <div className="space-y-1">
              <Label>Select Supplier / Vendor *</Label>
              {vendors.length > 0 ? (
                <select
                  value={selectedVendorId}
                  onChange={(e) => {
                    setSelectedVendorId(e.target.value);
                    const v = vendors.find((x) => x.id === e.target.value);
                    if (v) setVendorName(v.name);
                  }}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.email})
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="Enter Supplier Name"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Select Inventory Item *</Label>
                {inventoryItems.length > 0 ? (
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.sku})
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input placeholder="No items in inventory" disabled />
                )}
              </div>

              <div className="space-y-1">
                <Label>Order Quantity (Units)</Label>
                <Input
                  type="number"
                  value={poQuantity}
                  onChange={(e) => setPoQuantity(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Order Notes / Special Instructions</Label>
              <Input
                value={poNotes}
                onChange={(e) => setPoNotes(e.target.value)}
                placeholder="Deliver to Main Warehouse by Friday"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePO} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
              Create PO Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
