"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Building2, MapPin, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/_lib/auth-context";
import { INDIAN_STATES_AND_CITIES } from "@/_lib/india-location-data";
import { Button } from "@/_components/ui/button";
import { Input } from "@/_components/ui/input";
import { Label } from "@/_components/ui/label";
import { BrandMark } from "@/_components/brand-mark";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();

  const [companyName, setCompanyName] = useState(user?.companyName || "");
  const [selectedState, setSelectedState] = useState(user?.state || "");
  const [selectedCity, setSelectedCity] = useState(user?.city || "");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available cities for selected state
  const availableCities = useMemo(() => {
    if (!selectedState) return [];
    const stateObj = INDIAN_STATES_AND_CITIES.find((s) => s.state === selectedState);
    return stateObj ? stateObj.cities : [];
  }, [selectedState]);

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedState(e.target.value);
    setSelectedCity("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !selectedState || !selectedCity) {
      setError("Please fill in all company and location details.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await updateProfile({
        companyName: companyName.trim(),
        state: selectedState,
        city: selectedCity,
      });
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
      style={{ fontSize: "1.05rem", paddingTop: "8vh", paddingBottom: "8vh" }}
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
      <div className="relative z-10 flex w-full max-w-md flex-1 flex-col justify-center rounded-2xl border border-white/20 bg-card/70 text-card-foreground shadow-xl backdrop-blur-xl">
        <div className="px-6 py-8 sm:px-8 sm:py-10">
          {/* Header */}
          <div className="mb-6 text-center space-y-2">
            <div className="inline-flex items-center justify-center gap-2 mb-2">
              <BrandMark className="h-6 w-6" strokeClassName="text-foreground" />
              <span className="text-lg font-bold uppercase tracking-wide text-foreground">
                StockShiftAI
              </span>
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              Set Up Your Business
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter your company details to initialize your inventory workspace
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="companyName" className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
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

            {/* State Select */}
            <div className="space-y-2">
              <Label htmlFor="state" className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                State / Union Territory
              </Label>
              <select
                id="state"
                value={selectedState}
                onChange={handleStateChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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

            {/* City Select */}
            <div className="space-y-2">
              <Label htmlFor="city" className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                City / District
              </Label>
              <select
                id="city"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                disabled={!selectedState}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
              >
                <option value="">
                  {selectedState ? "-- Select City --" : "-- Select a State First --"}
                </option>
                {availableCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center text-sm text-red-500">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full py-5 font-semibold mt-2" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isLoading ? "Setting up..." : "Complete Setup"}
              {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
