"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Building2, MapPin, ArrowRight, Loader2, Sparkles, Package, Factory, Pill, Shirt, ShoppingCart, Cpu, Wrench, UtensilsCrossed } from "lucide-react";
import { useAuth } from "@/_lib/auth-context";
import { useInventory } from "@/_lib/inventory-context";
import { INDIAN_STATES_AND_CITIES } from "@/_lib/india-location-data";
import { Button } from "@/_components/ui/button";
import { Input } from "@/_components/ui/input";
import { Label } from "@/_components/ui/label";
import { BrandMark } from "@/_components/brand-mark";
import { cn } from "@/_lib/utils";

const INDUSTRIES = [
  { id: "retail-electronics", label: "Electronics & Gadgets", icon: Cpu },
  { id: "fmcg-grocery", label: "FMCG & Grocery", icon: ShoppingCart },
  { id: "pharmacy", label: "Pharmacy & Healthcare", icon: Pill },
  { id: "apparel-fashion", label: "Apparel & Fashion", icon: Shirt },
  { id: "hardware-industrial", label: "Hardware & Industrial", icon: Wrench },
  { id: "food-restaurant", label: "Food & Restaurant", icon: UtensilsCrossed },
  { id: "manufacturing", label: "Manufacturing", icon: Factory },
  { id: "general-retail", label: "General Retail", icon: Package },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const { addItem } = useInventory();

  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Company info
  const [companyName, setCompanyName] = useState(user?.companyName || "");
  const [selectedState, setSelectedState] = useState(user?.state || "");
  const [selectedCity, setSelectedCity] = useState(user?.city || "");
  const [selectedIndustry, setSelectedIndustry] = useState("");

  // Step 2: AI catalog
  const [isGeneratingCatalog, setIsGeneratingCatalog] = useState(false);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [catalogError, setCatalogError] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableCities = useMemo(() => {
    if (!selectedState) return [];
    const stateObj = INDIAN_STATES_AND_CITIES.find((s) => s.state === selectedState);
    return stateObj ? stateObj.cities : [];
  }, [selectedState]);

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedState(e.target.value);
    setSelectedCity("");
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !selectedState || !selectedCity || !selectedIndustry) {
      setError("Please fill in all details including your industry.");
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleGenerateCatalog = async () => {
    setIsGeneratingCatalog(true);
    setCatalogError("");
    try {
      const backendUrl = process.env.NEXT_PUBLIC_AI_BACKEND_URL || "http://localhost:5001";
      const res = await fetch(`${backendUrl}/api/ai/onboard-catalog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: INDUSTRIES.find((i) => i.id === selectedIndustry)?.label || selectedIndustry,
          companyName: companyName,
        }),
      });
      const data = await res.json();
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        setCatalogItems(data.items);
      } else {
        // Fallback items if array empty
        setCatalogItems([
          { name: "Wireless Noise Cancelling Earbuds", sku: "ELC-001", category: "Electronics", quantity: 45, unitCost: 1800, sellPrice: 3499, reorderPoint: 10, location: "Main Warehouse" },
          { name: "65W Fast USB-C Adapter", sku: "ELC-002", category: "Accessories", quantity: 120, unitCost: 450, sellPrice: 999, reorderPoint: 25, location: "Main Warehouse" },
          { name: "RGB Mechanical Keyboard", sku: "ELC-003", category: "Peripherals", quantity: 30, "unitCost": 2200, sellPrice: 4299, reorderPoint: 8, location: "Store Front" },
          { name: "27-inch 4K Monitor", sku: "ELC-004", category: "Displays", quantity: 15, unitCost: 14500, sellPrice: 21999, reorderPoint: 5, "location": "Main Warehouse" },
          { name: "10000mAh Power Bank", sku: "ELC-005", category: "Accessories", quantity: 80, unitCost: 600, sellPrice: 1299, reorderPoint: 15, location: "Store Front" }
        ]);
      }
    } catch {
      // Local fallback if backend unavailable
      setCatalogItems([
        { name: "Wireless Noise Cancelling Earbuds", sku: "ELC-001", category: "Electronics", quantity: 45, unitCost: 1800, sellPrice: 3499, reorderPoint: 10, location: "Main Warehouse" },
        { name: "65W Fast USB-C Adapter", sku: "ELC-002", category: "Accessories", quantity: 120, unitCost: 450, sellPrice: 999, reorderPoint: 25, location: "Main Warehouse" },
        { name: "RGB Mechanical Keyboard", sku: "ELC-003", category: "Peripherals", quantity: 30, unitCost: 2200, sellPrice: 4299, reorderPoint: 8, location: "Store Front" },
        { name: "27-inch 4K Monitor", sku: "ELC-004", category: "Displays", quantity: 15, unitCost: 14500, sellPrice: 21999, reorderPoint: 5, location: "Main Warehouse" },
        { name: "10000mAh Power Bank", sku: "ELC-005", category: "Accessories", quantity: 80, unitCost: 600, sellPrice: 1299, reorderPoint: 15, location: "Store Front" }
      ]);
    } finally {
      setIsGeneratingCatalog(false);
    }
  };

  const handleCompleteSetup = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Save profile
      await updateProfile({
        companyName: companyName.trim(),
        state: selectedState,
        city: selectedCity,
      });

      // Insert AI-generated catalog items if any
      if (catalogItems.length > 0) {
        for (const item of catalogItems) {
          try {
            await addItem({
              name: item.name || "Unnamed Item",
              sku: item.sku || `SKU-${Date.now().toString().slice(-4)}`,
              category: item.category || "General",
              quantity: Number(item.quantity) || 0,
              unitCost: Number(item.unitCost) || 0,
              sellPrice: Number(item.sellPrice) || 0,
              reorderPoint: Number(item.reorderPoint) || 10,
              location: item.location || "Main Warehouse",
            });
          } catch {
            // Skip duplicate items silently
          }
        }
      }

      router.push("/admin/dashboard");
    } catch (err: any) {
      setError(err?.message || "Failed to save profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6"
      style={{ fontSize: "1.05rem", paddingTop: "6vh", paddingBottom: "6vh" }}
    >
      {/* Top spotlight gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0">
        <div className="h-52 w-full rounded-b-[999px] bg-gradient-to-b from-[#B8FFD0] to-[#FFF6C9] blur-2xl opacity-100 spotlight-animate" />
      </div>
      {/* Bottom spotlight gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0">
        <div className="h-28 w-full rounded-t-[999px] bg-gradient-to-t from-[#B8FFD0] to-[#FFF6C9] blur-2xl opacity-100 spotlight-animate" />
      </div>

      {/* Card container */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/20 bg-card/70 text-card-foreground shadow-xl backdrop-blur-xl">
        <div className="px-6 py-8 sm:px-8 sm:py-10">
          {/* Header */}
          <div className="mb-6 text-center space-y-2">
            <div className="inline-flex items-center justify-center gap-2 mb-2">
              <BrandMark className="h-6 w-6" strokeClassName="text-foreground" />
              <span className="text-lg font-bold uppercase tracking-wide text-foreground">
                StockShiftAI
              </span>
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className={cn("h-2 w-8 rounded-full transition-colors", step >= 1 ? "bg-emerald-500" : "bg-muted")} />
              <div className={cn("h-2 w-8 rounded-full transition-colors", step >= 2 ? "bg-emerald-500" : "bg-muted")} />
            </div>

            <h2 className="text-2xl font-bold text-foreground">
              {step === 1 ? "Set Up Your Business" : "AI Catalog Setup"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {step === 1
                ? "Enter your company details and select your industry"
                : "Let AI generate a starter inventory for your business"}
            </p>
          </div>

          {/* STEP 1: Company Details + Industry */}
          {step === 1 && (
            <form onSubmit={handleStep1Submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  Company Name
                </Label>
                <Input
                  id="companyName"
                  type="text"
                  placeholder="e.g. Apex Enterprises"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>

              {/* State */}
              <div className="space-y-2">
                <Label htmlFor="state" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  State / Union Territory
                </Label>
                <select
                  id="state"
                  value={selectedState}
                  onChange={handleStateChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="">-- Select State --</option>
                  {INDIAN_STATES_AND_CITIES.map((loc) => (
                    <option key={loc.state} value={loc.state}>
                      {loc.state}
                    </option>
                  ))}
                </select>
              </div>

              {/* City */}
              <div className="space-y-2">
                <Label htmlFor="city" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  City / District
                </Label>
                <select
                  id="city"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  disabled={!selectedState}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                  <option value="">
                    {selectedState ? "-- Select City --" : "-- Select a State First --"}
                  </option>
                  {availableCities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              {/* Industry Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Factory className="h-4 w-4 text-emerald-600" />
                  Industry Type
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {INDUSTRIES.map((ind) => (
                    <button
                      key={ind.id}
                      type="button"
                      onClick={() => setSelectedIndustry(ind.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-all duration-200",
                        selectedIndustry === ind.id
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm"
                          : "border-border/60 bg-background text-muted-foreground hover:border-emerald-300 hover:bg-emerald-50/30"
                      )}
                    >
                      <ind.icon className="h-4 w-4 shrink-0" />
                      <span>{ind.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center text-sm text-red-500">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full py-5 font-semibold mt-2">
                Continue to AI Setup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          )}

          {/* STEP 2: AI Catalog Generation */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">
                  Industry: <span className="font-semibold text-foreground">{INDUSTRIES.find((i) => i.id === selectedIndustry)?.label}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Company: <span className="font-semibold text-foreground">{companyName}</span>
                </p>
              </div>

              {/* Generate button */}
              {catalogItems.length === 0 && !isGeneratingCatalog && (
                <div className="space-y-3">
                  <Button
                    onClick={handleGenerateCatalog}
                    className="w-full py-5 font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate AI Starter Catalog
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    AI will create 12-15 realistic products with prices, SKUs, and reorder points for your industry.
                  </p>
                </div>
              )}

              {/* Loading state */}
              {isGeneratingCatalog && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                  <p className="text-sm text-muted-foreground">AI is generating your catalog...</p>
                </div>
              )}

              {/* Catalog preview */}
              {catalogItems.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-emerald-700 text-center">
                    ✓ {catalogItems.length} items generated
                  </p>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40">
                    {catalogItems.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2 text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{item.name}</p>
                          <p className="text-muted-foreground">{item.sku} · {item.category}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="font-semibold text-foreground">{item.quantity} units</p>
                          <p className="text-muted-foreground">₹{item.unitCost}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {catalogError && (
                <p className="text-xs text-amber-600 text-center">{catalogError}</p>
              )}

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center text-sm text-red-500">
                  {error}
                </div>
              )}

              {/* Complete Setup */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={handleCompleteSetup}
                  disabled={isLoading}
                  className="flex-1 font-semibold"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {isLoading ? "Setting up..." : catalogItems.length > 0 ? "Add Items & Continue" : "Skip & Continue"}
                  {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
