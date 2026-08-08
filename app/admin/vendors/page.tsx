"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/_lib/auth-context";
import { getSupabaseClient } from "@/_lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/_components/ui/card";
import { Button } from "@/_components/ui/button";
import { Input } from "@/_components/ui/input";
import { Label } from "@/_components/ui/label";
import { Badge } from "@/_components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/_components/ui/dialog";
import { Users, Plus, Mail, Phone, Clock, Package, Building2, Trash2, Edit, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/_lib/utils";
import type { Vendor } from "@/_lib/types";

export default function VendorsPage() {
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [modalTab, setModalTab] = useState<"manual" | "ai">("manual");
  const [aiRawText, setAiRawText] = useState("");
  const [aiParsing, setAiParsing] = useState(false);
  const [aiError, setAiError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    leadTimeDays: 7,
    minOrderQty: 10,
    paymentTerms: "Net 30",
    notes: "",
  });

  const fetchVendors = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setVendors(
          data.map((row: any) => ({
            id: row.id,
            name: row.name,
            contactPerson: row.contact_person || "",
            email: row.email,
            phone: row.phone || "",
            address: row.address || "",
            leadTimeDays: Number(row.lead_time_days || 7),
            minOrderQty: Number(row.min_order_qty || 10),
            paymentTerms: row.payment_terms || "Net 30",
            notes: row.notes || "",
            createdAt: row.created_at,
          }))
        );
      }
    } catch (err) {
      console.error("Error fetching vendors:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [user]);

  const handleOpenAdd = () => {
    setEditingVendor(null);
    setModalTab("manual");
    setAiRawText("");
    setAiError("");
    setFormData({
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      leadTimeDays: 7,
      minOrderQty: 10,
      paymentTerms: "Net 30",
      notes: "",
    });
    setIsModalOpen(true);
  };

  const handleAiParseVendor = async () => {
    if (!aiRawText.trim()) return;
    setAiParsing(true);
    setAiError("");
    try {
      const backendUrl = process.env.NEXT_PUBLIC_AI_BACKEND_URL || "http://localhost:5001";
      const res = await fetch(`${backendUrl}/api/ai/parse-vendor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiRawText }),
      });
      const data = await res.json();
      if (data.vendor) {
        setFormData({
          name: data.vendor.name || "",
          contactPerson: data.vendor.contactPerson || "",
          email: data.vendor.email || "",
          phone: data.vendor.phone || "",
          address: data.vendor.address || "",
          leadTimeDays: Number(data.vendor.leadTimeDays) || 7,
          minOrderQty: Number(data.vendor.minOrderQty) || 10,
          paymentTerms: data.vendor.paymentTerms || "Net 30",
          notes: data.vendor.notes || "",
        });
        setModalTab("manual"); // Switch to manual tab to show filled form
      } else {
        setAiError(data.error || "Could not extract vendor details.");
      }
    } catch {
      setAiError("AI service unavailable. Please fill details manually.");
    } finally {
      setAiParsing(false);
    }
  };

  const handleOpenEdit = (v: Vendor) => {
    setEditingVendor(v);
    setFormData({
      name: v.name,
      contactPerson: v.contactPerson || "",
      email: v.email,
      phone: v.phone || "",
      address: v.address || "",
      leadTimeDays: v.leadTimeDays,
      minOrderQty: v.minOrderQty,
      paymentTerms: v.paymentTerms || "Net 30",
      notes: v.notes || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formData.name || !formData.email) return;

    const payload = {
      user_id: user.id,
      name: formData.name,
      contact_person: formData.contactPerson,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      lead_time_days: formData.leadTimeDays,
      min_order_qty: formData.minOrderQty,
      payment_terms: formData.paymentTerms,
      notes: formData.notes,
    };

    if (editingVendor) {
      await supabase.from("vendors").update(payload).eq("id", editingVendor.id);
    } else {
      await supabase.from("vendors").insert(payload);
    }

    setIsModalOpen(false);
    fetchVendors();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this vendor?")) return;
    await supabase.from("vendors").delete().eq("id", id);
    fetchVendors();
  };

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground sm:text-3xl">
            <Users className="w-8 h-8 text-emerald-600" />
            Vendor Directory &amp; Suppliers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your suppliers, lead times, minimum order quantities (MOQ), and payment SLAs.
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
          <Plus className="w-4 h-4 mr-2" /> Add New Vendor
        </Button>
      </div>

      {/* Vendors Grid */}
      {loading ? (
        <div className="p-12 text-center text-muted-foreground text-sm">
          Loading vendor database...
        </div>
      ) : vendors.length === 0 ? (
        <Card className="border-2 border-dashed border-emerald-500/30 bg-card/60 p-8 text-center shadow-none">
          <div className="mx-auto flex max-w-md flex-col items-center justify-center space-y-3">
            <div className="rounded-full bg-emerald-500/10 p-4 text-emerald-600">
              <Building2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground">No Suppliers Added Yet</h3>
            <p className="text-sm text-muted-foreground">
              Add your primary suppliers to automate purchase orders and track average delivery lead times.
            </p>
            <Button onClick={handleOpenAdd} className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
              <Plus className="h-4 w-4 mr-2" /> Add Your First Vendor
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((vendor) => (
            <Card key={vendor.id} className="border-border/60 shadow-none hover:shadow-md transition-shadow">
              <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">{vendor.name}</CardTitle>
                  {vendor.contactPerson && (
                    <p className="text-xs text-muted-foreground mt-0.5">Contact: {vendor.contactPerson}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleOpenEdit(vendor)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-600" onClick={() => handleDelete(vendor.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate text-foreground font-medium">{vendor.email}</span>
                  </div>
                  {vendor.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="text-foreground">{vendor.phone}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                  <div className="bg-muted/30 p-2 rounded">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600" /> Avg Lead Time:
                    </span>
                    <span className="font-bold text-foreground block mt-0.5">{vendor.leadTimeDays} Days</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Package className="w-3 h-3 text-blue-600" /> Min Order (MOQ):
                    </span>
                    <span className="font-bold text-foreground block mt-0.5">{vendor.minOrderQty} Units</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 text-xs">
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-0">
                    SLA: {vendor.paymentTerms}
                  </Badge>
                  {vendor.address && (
                    <span className="text-muted-foreground truncate max-w-[140px] text-right">{vendor.address}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>{editingVendor ? "Edit Vendor Details" : "Add New Vendor"}</DialogTitle>
          </DialogHeader>

          {/* Tab switcher (only on Add, not Edit) */}
          {!editingVendor && (
            <div className="flex gap-1 bg-muted/30 rounded-lg p-1 mb-2">
              <button
                onClick={() => setModalTab("manual")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold transition-all",
                  modalTab === "manual" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Edit className="h-3.5 w-3.5" /> Manual Entry
              </button>
              <button
                onClick={() => setModalTab("ai")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold transition-all",
                  modalTab === "ai" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="h-3.5 w-3.5" /> AI Auto-Fill
              </button>
            </div>
          )}

          {/* AI Auto-Fill Tab */}
          {modalTab === "ai" && !editingVendor && (
            <div className="space-y-3 py-2">
              <p className="text-xs text-muted-foreground">
                Paste a vendor invoice, rate card, email, or website text below and AI will extract all details.
              </p>
              <textarea
                value={aiRawText}
                onChange={(e) => setAiRawText(e.target.value)}
                placeholder={`e.g.\nApex Electronics Ltd\nContact: Rahul Sharma\nEmail: orders@apex.in\nPhone: +91 98765 43210\nPayment: Net 30 days\nMinimum Order: 50 units\nDelivery: 5-7 business days\nAddress: Plot 42, MIDC, Pune`}
                rows={7}
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
              />
              {aiError && <p className="text-xs text-red-500">{aiError}</p>}
              <Button
                onClick={handleAiParseVendor}
                disabled={aiParsing || !aiRawText.trim()}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold"
              >
                {aiParsing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Extracting...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Extract Vendor Details</>
                )}
              </Button>
            </div>
          )}

          {/* Manual Entry Tab */}
          {(modalTab === "manual" || editingVendor) && (
            <div className="grid gap-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Vendor / Company Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Apex Electronics Ltd"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Contact Person</Label>
                  <Input
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="Rahul Sharma"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Email Address *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="orders@apexelectronics.in"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Phone Number</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Lead Time (Days)</Label>
                  <Input
                    type="number"
                    value={formData.leadTimeDays}
                    onChange={(e) => setFormData({ ...formData, leadTimeDays: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Min Order Qty</Label>
                  <Input
                    type="number"
                    value={formData.minOrderQty}
                    onChange={(e) => setFormData({ ...formData, minOrderQty: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Payment Terms</Label>
                  <Input
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    placeholder="Net 30"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Factory / Office Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Plot 42, MIDC Industrial Area, Pune"
                />
              </div>
            </div>
          )}

          {(modalTab === "manual" || editingVendor) && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                Save Vendor
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
