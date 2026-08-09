"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Building2, MapPin, ArrowRight, Loader2, Package, Factory, Pill, Shirt, ShoppingCart, Cpu, Wrench, UtensilsCrossed } from "lucide-react";
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

const FALLBACK_CATALOGS_BY_INDUSTRY: Record<string, any[]> = {
  "food-restaurant": [
    { name: "Fresh Whole Milk (1 Litre Pouch)", sku: "DRY-001", category: "Raw Dairy", quantity: 250, unitCost: 52, sellPrice: 66, reorderPoint: 50, location: "Cold Storage A" },
    { name: "Pasteurized Toned Milk (500ml Pack)", sku: "DRY-002", category: "Raw Dairy", quantity: 300, unitCost: 26, sellPrice: 33, reorderPoint: 60, location: "Cold Storage A" },
    { name: "Fresh Farm Cottage Cheese / Paneer 500g", sku: "DRY-003", category: "Raw Dairy", quantity: 120, unitCost: 160, sellPrice: 220, reorderPoint: 25, location: "Cold Storage A" },
    { name: "Salted Creamery Butter 500g Pack", sku: "DRY-004", category: "Raw Dairy", quantity: 180, unitCost: 210, sellPrice: 275, reorderPoint: 30, location: "Cold Storage A" },
    { name: "Pure Desi Cow Ghee (1 Litre Jar)", sku: "DRY-005", category: "Raw Dairy", quantity: 90, unitCost: 520, sellPrice: 680, reorderPoint: 20, location: "Main Pantry" },
    { name: "Fresh Dairy Whipping Cream 250ml", sku: "DRY-006", category: "Raw Dairy", quantity: 100, unitCost: 65, sellPrice: 95, reorderPoint: 20, location: "Cold Storage A" },
    { name: "Mozzarella Cheese Block (1kg Pack)", sku: "DRY-007", category: "Raw Dairy", quantity: 75, unitCost: 380, sellPrice: 520, reorderPoint: 15, location: "Cold Storage A" },
    { name: "Processed Cheese Slices (200g Pack)", sku: "DRY-008", category: "Raw Dairy", quantity: 140, unitCost: 110, sellPrice: 155, reorderPoint: 30, location: "Cold Storage A" },
    { name: "Plain Fresh Set Curd / Dahi 500g", sku: "DRY-009", category: "Raw Dairy", quantity: 210, unitCost: 38, sellPrice: 50, reorderPoint: 40, location: "Cold Storage A" },
    { name: "Full-Cream Milk Powder (1kg Bag)", sku: "DRY-010", category: "Raw Dairy", quantity: 60, unitCost: 340, sellPrice: 440, reorderPoint: 12, location: "Main Pantry" },
    { name: "Sweetened Condensed Milk 400g Tin", sku: "DRY-011", category: "Raw Dairy", quantity: 85, unitCost: 90, sellPrice: 130, reorderPoint: 15, location: "Main Pantry" },
    { name: "Premium Basmati Biryani Rice 5kg", sku: "GRN-001", category: "Grains & Rice", quantity: 150, unitCost: 420, sellPrice: 620, reorderPoint: 30, location: "Main Pantry" },
    { name: "Organic Whole Wheat Atta 10kg", sku: "STP-001", category: "Flour & Staples", quantity: 110, unitCost: 350, sellPrice: 460, reorderPoint: 20, location: "Main Pantry" },
    { name: "Refined Sunflower Cooking Oil 5L", sku: "OIL-001", category: "Oils & Fats", quantity: 95, unitCost: 580, sellPrice: 750, reorderPoint: 20, location: "Main Pantry" },
    { name: "Cold Pressed Mustard Oil 1L", sku: "OIL-002", category: "Oils & Fats", quantity: 130, unitCost: 125, sellPrice: 170, reorderPoint: 25, location: "Main Pantry" },
    { name: "Unpolished Toor Dal (Pigeon Pea) 2kg", sku: "PLS-001", category: "Pulses & Legumes", quantity: 140, unitCost: 220, sellPrice: 310, reorderPoint: 25, location: "Main Pantry" },
    { name: "Organic Chana Dal (Bengal Gram) 1kg", sku: "PLS-002", category: "Pulses & Legumes", quantity: 160, unitCost: 80, sellPrice: 115, reorderPoint: 30, location: "Main Pantry" },
    { name: "Premium Red Kidney Beans / Rajma 1kg", sku: "PLS-003", category: "Pulses & Legumes", quantity: 125, unitCost: 110, sellPrice: 160, reorderPoint: 20, location: "Main Pantry" },
    { name: "Special Garam Masala Powder 200g", sku: "SPC-001", category: "Spices & Seasonings", quantity: 180, unitCost: 75, sellPrice: 120, reorderPoint: 35, location: "Main Pantry" },
    { name: "Organic Turmeric Powder / Haldi 500g", sku: "SPC-002", category: "Spices & Seasonings", quantity: 190, unitCost: 90, sellPrice: 140, reorderPoint: 35, location: "Main Pantry" },
    { name: "Kashmiri Red Chilli Powder 200g", sku: "SPC-003", category: "Spices & Seasonings", quantity: 175, unitCost: 85, sellPrice: 135, reorderPoint: 30, location: "Main Pantry" },
    { name: "Pure Iodized Table Salt 1kg Pack", sku: "STP-002", category: "Flour & Staples", quantity: 400, unitCost: 18, sellPrice: 28, reorderPoint: 80, location: "Main Pantry" },
    { name: "Refined White Sugar 5kg Bag", sku: "STP-003", category: "Flour & Staples", quantity: 130, unitCost: 200, sellPrice: 260, reorderPoint: 25, location: "Main Pantry" },
    { name: "Raw Assam Black Tea Leaf 500g", sku: "BEV-001", category: "Beverages", quantity: 110, unitCost: 160, sellPrice: 240, reorderPoint: 20, location: "Main Pantry" },
    { name: "Freeze Dried Instant Coffee Powder 200g", sku: "BEV-002", category: "Beverages", quantity: 90, unitCost: 220, sellPrice: 340, reorderPoint: 15, location: "Main Pantry" },
    { name: "Rich Tomato Ketchup Bottle 1kg", sku: "CND-001", category: "Condiments", quantity: 140, unitCost: 85, sellPrice: 135, reorderPoint: 25, location: "Main Pantry" },
    { name: "Spicy Green Chilli Sauce 500ml", sku: "CND-002", category: "Condiments", quantity: 120, unitCost: 45, sellPrice: 75, reorderPoint: 20, location: "Main Pantry" },
    { name: "Authentic Dark Soy Sauce 500ml", sku: "CND-003", category: "Condiments", quantity: 105, unitCost: 55, sellPrice: 90, reorderPoint: 18, location: "Main Pantry" },
    { name: "Pure Wildflower Natural Honey 500g", sku: "CND-004", category: "Condiments", quantity: 85, unitCost: 180, sellPrice: 270, reorderPoint: 15, location: "Main Pantry" },
    { name: "Dry Roasted Jumbo Almonds 500g", sku: "DFT-001", category: "Dry Fruits", quantity: 70, unitCost: 380, sellPrice: 560, reorderPoint: 12, location: "Main Pantry" }
  ],
  "retail-electronics": [
    { name: "Wireless Noise Cancelling Earbuds", sku: "ELC-001", category: "Audio", quantity: 45, unitCost: 1800, sellPrice: 3499, reorderPoint: 10, location: "Main Warehouse" },
    { name: "65W Fast Charging USB-C Adapter", sku: "ELC-002", category: "Accessories", quantity: 120, unitCost: 450, sellPrice: 999, reorderPoint: 25, location: "Main Warehouse" },
    { name: "RGB Mechanical Gaming Keyboard", sku: "ELC-003", category: "Peripherals", quantity: 30, unitCost: 2200, sellPrice: 4299, reorderPoint: 8, location: "Store Front" },
    { name: "Ultra-Wide 27-inch 4K Monitor", sku: "ELC-004", category: "Displays", quantity: 15, unitCost: 14500, sellPrice: 21999, reorderPoint: 5, location: "Main Warehouse" },
    { name: "20000mAh Slim Power Bank", sku: "ELC-005", category: "Accessories", quantity: 80, unitCost: 800, sellPrice: 1599, reorderPoint: 15, location: "Store Front" },
    { name: "Full HD Web Camera 1080p", sku: "ELC-006", category: "Peripherals", quantity: 50, unitCost: 950, sellPrice: 1899, reorderPoint: 10, location: "Main Warehouse" },
    { name: "Smart Fitness Watch Series 5", sku: "ELC-007", category: "Wearables", quantity: 60, unitCost: 1500, sellPrice: 2999, reorderPoint: 12, location: "Store Front" },
    { name: "Ergonomic Wireless Mouse", sku: "ELC-008", category: "Peripherals", quantity: 90, unitCost: 350, sellPrice: 799, reorderPoint: 20, location: "Main Warehouse" },
    { name: "USB-C Multi-Port Hub 7-in-1", sku: "ELC-009", category: "Accessories", quantity: 40, unitCost: 1100, sellPrice: 2199, reorderPoint: 10, location: "Main Warehouse" },
    { name: "Portable Bluetooth Speaker 20W", sku: "ELC-010", category: "Audio", quantity: 35, unitCost: 1400, sellPrice: 2799, reorderPoint: 8, location: "Store Front" },
    { name: "PCIe NVMe M.2 1TB Internal SSD", sku: "ELC-011", category: "Components", quantity: 25, unitCost: 3800, sellPrice: 5999, reorderPoint: 5, location: "Main Warehouse" },
    { name: "16GB DDR4 3200MHz RAM Module", sku: "ELC-012", category: "Components", quantity: 30, unitCost: 2100, sellPrice: 3499, reorderPoint: 8, location: "Main Warehouse" },
    { name: "Wi-Fi 6 Dual-Band Gigabit Router", sku: "ELC-013", category: "Networking", quantity: 20, unitCost: 1900, sellPrice: 3299, reorderPoint: 5, location: "Store Front" },
    { name: "High-Speed Braided HDMI 2.1 Cable 2m", sku: "ELC-014", category: "Cables", quantity: 100, unitCost: 250, sellPrice: 599, reorderPoint: 20, location: "Main Warehouse" },
    { name: "USB Studio Condenser Microphone", sku: "ELC-015", category: "Audio", quantity: 18, unitCost: 2500, sellPrice: 4499, reorderPoint: 4, location: "Store Front" }
  ],
  "pharmacy": [
    { name: "Paracetamol 650mg Tablets (Strip of 15)", sku: "PHM-001", category: "OTC Medicine", quantity: 500, unitCost: 12, sellPrice: 30, reorderPoint: 100, location: "Pharmacy Shelf A" },
    { name: "Vitamin C + Zinc Chewable (30 Tabs)", sku: "PHM-002", category: "Supplements", quantity: 150, unitCost: 85, sellPrice: 175, reorderPoint: 30, location: "Pharmacy Shelf B" },
    { name: "Digital Infrared Thermometer", sku: "PHM-003", category: "Devices", quantity: 40, unitCost: 650, sellPrice: 1299, reorderPoint: 10, location: "Main Warehouse" },
    { name: "Automatic Blood Pressure Monitor", sku: "PHM-004", category: "Devices", quantity: 25, unitCost: 1100, sellPrice: 1999, reorderPoint: 5, location: "Main Warehouse" },
    { name: "Antiseptic Liquid 500ml", sku: "PHM-005", category: "First Aid", quantity: 100, unitCost: 90, sellPrice: 145, reorderPoint: 20, location: "Pharmacy Shelf A" },
    { name: "Fingertip Pulse Oximeter OLED", sku: "PHM-006", category: "Devices", quantity: 35, unitCost: 450, sellPrice: 999, reorderPoint: 8, location: "Pharmacy Shelf B" },
    { name: "N95 Protective Face Masks (Pack of 10)", sku: "PHM-007", category: "Personal Safety", quantity: 200, unitCost: 120, sellPrice: 250, reorderPoint: 40, location: "Main Warehouse" },
    { name: "Absorbent Surgical Cotton 500g", sku: "PHM-008", category: "First Aid", quantity: 80, unitCost: 95, sellPrice: 160, reorderPoint: 15, location: "Pharmacy Shelf A" },
    { name: "Microporous Medical Tape 1 inch", sku: "PHM-009", category: "First Aid", quantity: 120, unitCost: 35, sellPrice: 65, reorderPoint: 25, location: "Pharmacy Shelf A" },
    { name: "Elastic Bandage Roll 4 inch", sku: "PHM-010", category: "First Aid", quantity: 140, unitCost: 45, sellPrice: 85, reorderPoint: 30, location: "Pharmacy Shelf A" }
  ],
  "apparel-fashion": [
    { name: "Men's Slim Fit Stretch Denim Jeans", sku: "APP-001", category: "Bottomwear", quantity: 80, unitCost: 650, sellPrice: 1499, reorderPoint: 15, location: "Main Warehouse" },
    { name: "Women's Printed Cotton Kurti", sku: "APP-002", category: "Ethnicwear", quantity: 110, unitCost: 380, sellPrice: 899, reorderPoint: 20, location: "Store Front" },
    { name: "Heavyweight Cotton Crewneck T-Shirt", sku: "APP-003", category: "Topwear", quantity: 200, unitCost: 220, sellPrice: 599, reorderPoint: 40, location: "Store Front" },
    { name: "Men's Casual Button-Down Shirt", sku: "APP-004", category: "Topwear", quantity: 90, unitCost: 480, sellPrice: 1199, reorderPoint: 18, location: "Main Warehouse" },
    { name: "Fleece Oversized Pullover Hoodie", sku: "APP-005", category: "Winterwear", quantity: 65, unitCost: 750, sellPrice: 1799, reorderPoint: 12, location: "Store Front" },
    { name: "Formal Trousers Regular Fit Navy", sku: "APP-006", category: "Bottomwear", quantity: 70, unitCost: 580, sellPrice: 1399, reorderPoint: 15, location: "Main Warehouse" },
    { name: "Athletic Quick-Dry Running Shorts", sku: "APP-007", category: "Activewear", quantity: 120, unitCost: 280, sellPrice: 699, reorderPoint: 25, location: "Store Front" },
    { name: "Genuine Leather Belt Brown", sku: "APP-008", category: "Accessories", quantity: 150, unitCost: 180, sellPrice: 499, reorderPoint: 30, location: "Store Front" }
  ],
  "hardware-industrial": [
    { name: "18V Cordless Impact Drill Kit", sku: "HWD-001", category: "Power Tools", quantity: 25, unitCost: 2800, sellPrice: 4999, reorderPoint: 5, location: "Main Warehouse" },
    { name: "Stainless Steel Wood Screws M4 (Box of 500)", sku: "HWD-002", category: "Fasteners", quantity: 100, unitCost: 180, sellPrice: 399, reorderPoint: 20, location: "Main Warehouse" },
    { name: "Industrial Safety Helmet Yellow", sku: "HWD-003", category: "Safety Gear", quantity: 80, unitCost: 220, sellPrice: 499, reorderPoint: 15, location: "Main Warehouse" },
    { name: "Digital Vernier Caliper 150mm Stainless", sku: "HWD-004", category: "Measuring", quantity: 30, unitCost: 650, sellPrice: 1399, reorderPoint: 6, location: "Store Front" },
    { name: "Heavy-Duty Angle Grinder 850W", sku: "HWD-005", category: "Power Tools", quantity: 20, unitCost: 1600, sellPrice: 2899, reorderPoint: 4, location: "Main Warehouse" },
    { name: "Combination Pliers 8-inch Insulated", sku: "HWD-006", category: "Hand Tools", quantity: 90, unitCost: 190, sellPrice: 420, reorderPoint: 18, location: "Store Front" }
  ],
  "fmcg-grocery": [
    { name: "Fresh Whole Milk 1 Litre Pouch", sku: "FMC-001", category: "Dairy", quantity: 200, unitCost: 52, sellPrice: 66, reorderPoint: 40, location: "Cold Storage A" },
    { name: "Fresh Cottage Cheese Paneer 200g", sku: "FMC-002", category: "Dairy", quantity: 100, unitCost: 75, sellPrice: 105, reorderPoint: 20, location: "Cold Storage A" },
    { name: "Salted Dairy Butter 500g", sku: "FMC-003", category: "Dairy", quantity: 120, unitCost: 210, sellPrice: 275, reorderPoint: 25, location: "Cold Storage A" },
    { name: "Basmati Premium Rice 5kg", sku: "FMC-004", category: "Staples", quantity: 150, unitCost: 320, sellPrice: 499, reorderPoint: 30, location: "Main Warehouse" },
    { name: "Refined Sunflower Oil 1L", sku: "FMC-005", category: "Oils & Ghee", quantity: 200, unitCost: 110, sellPrice: 145, reorderPoint: 40, location: "Store Front" }
  ],
  "manufacturing": [
    { name: "Aluminum Alloy Sheet 2mm (4x8 ft)", sku: "MFG-001", category: "Raw Metals", quantity: 40, unitCost: 2200, sellPrice: 3800, reorderPoint: 8, location: "Raw Material Yard" },
    { name: "Cold Rolled Steel Coil 1.5mm", sku: "MFG-002", category: "Raw Metals", quantity: 25, unitCost: 4500, sellPrice: 7200, reorderPoint: 5, location: "Raw Material Yard" },
    { name: "Stainless Steel Round Rod 25mm Dia", sku: "MFG-003", category: "Raw Metals", quantity: 60, unitCost: 850, sellPrice: 1499, reorderPoint: 12, location: "Raw Material Yard" },
    { name: "High-Density Polyethylene (HDPE) Granules 25kg", sku: "MFG-005", category: "Polymers", quantity: 100, unitCost: 1800, sellPrice: 2799, reorderPoint: 20, location: "Main Warehouse" }
  ],
  "general-retail": [
    { name: "Matte Finish Ceramic Coffee Mug 350ml", sku: "GEN-001", category: "Home & Kitchen", quantity: 120, unitCost: 85, sellPrice: 249, reorderPoint: 25, location: "Store Front" },
    { name: "Insulated Stainless Steel Water Bottle 1L", sku: "GEN-002", category: "Home & Kitchen", quantity: 90, unitCost: 280, sellPrice: 699, reorderPoint: 18, location: "Store Front" },
    { name: "Desktop Mesh Office Desk Organizer", sku: "GEN-003", category: "Stationery", quantity: 70, unitCost: 190, sellPrice: 499, reorderPoint: 15, location: "Main Warehouse" },
    { name: "Adjustable LED Eye-Care Desk Lamp", sku: "GEN-004", category: "Electronics", quantity: 45, unitCost: 450, sellPrice: 999, reorderPoint: 10, location: "Store Front" }
  ]
};

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

  const handleSelectIndustry = (industryId: string) => {
    setSelectedIndustry(industryId);
    setCatalogItems([]); // Reset catalog so user can generate fresh items if industry changes
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
    const industryLabel = INDUSTRIES.find((i) => i.id === selectedIndustry)?.label || selectedIndustry;
    const fallbackList = FALLBACK_CATALOGS_BY_INDUSTRY[selectedIndustry] || FALLBACK_CATALOGS_BY_INDUSTRY["food-restaurant"];

    try {
      const backendUrl = process.env.NEXT_PUBLIC_AI_BACKEND_URL || "http://localhost:5001";
      const res = await fetch(`${backendUrl}/api/ai/onboard-catalog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: industryLabel,
          companyName: companyName,
        }),
      });
      const data = await res.json();
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        setCatalogItems(data.items);
      } else {
        setCatalogItems(fallbackList);
      }
    } catch {
      // Industry-matched fallback if backend offline
      setCatalogItems(fallbackList);
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
              {step === 1 ? "Set Up Your Business" : "Starter Inventory Setup"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {step === 1
                ? "Enter your company details and select your industry"
                : "Add starter items to initialize your inventory workspace"}
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
                      onClick={() => handleSelectIndustry(ind.id)}
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
                Continue to Product Setup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          )}

          {/* STEP 2: Starter Catalog Setup */}
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
                    <Package className="mr-2 h-4 w-4" />
                    Add few products to start
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Automatically generates realistic starter products tailored to your industry.
                  </p>
                </div>
              )}

              {/* Loading state */}
              {isGeneratingCatalog && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                  <p className="text-sm text-muted-foreground">Setting up starter products...</p>
                </div>
              )}

              {/* Catalog preview */}
              {catalogItems.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-emerald-700 text-center">
                    ✓ {catalogItems.length} Products Added
                  </p>
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40">
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
                <Button variant="outline" onClick={() => { setCatalogItems([]); setStep(1); }} className="flex-1">
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
