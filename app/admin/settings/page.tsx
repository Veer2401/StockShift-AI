"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/_lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/_components/ui/avatar";
import { Button } from "@/_components/ui/button";
import { Input } from "@/_components/ui/input";
import { Label } from "@/_components/ui/label";
import { Separator } from "@/_components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/_components/ui/card";
import { User, Bell, Shield, Palette, Building2, ArrowRight, LogOut, Key, Copy, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, updateProfile, logout } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [companyName, setCompanyName] = useState(user?.companyName ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [state, setState] = useState(user?.state ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // API keys state
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("POS Terminal Key");
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_AI_BACKEND_URL || "http://localhost:5001";

  const fetchApiKeys = async () => {
    if (!user) return;
    setIsLoadingKeys(true);
    try {
      const res = await fetch(`${backendUrl}/api/v1/api-keys/${user.id}`);
      const data = await res.json();
      setApiKeys(data.keys || []);
    } catch { /* ignore */ }
    setIsLoadingKeys(false);
  };

  useEffect(() => {
    fetchApiKeys();
  }, [user]);

  const handleCreateKey = async () => {
    if (!user) return;
    setIsCreatingKey(true);
    try {
      const res = await fetch(`${backendUrl}/api/v1/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, label: newKeyLabel }),
      });
      await res.json();
      await fetchApiKeys();
      setNewKeyLabel("POS Terminal Key");
    } catch { /* ignore */ }
    setIsCreatingKey(false);
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    try {
      await fetch(`${backendUrl}/api/v1/api-keys/${keyId}/revoke`, { method: "POST" });
      await fetchApiKeys();
    } catch { /* ignore */ }
  };

  const handleCopyKey = (key: string, keyId: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(keyId);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await updateProfile({
        name,
        companyName,
        city,
        state,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update profile:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account, organization details, and application preferences.
        </p>
      </div>

      {/* Profile */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-foreground">
              <User className="h-[18px] w-[18px]" />
            </div>
            <div>
              <CardTitle className="text-base">Profile &amp; Organization</CardTitle>
              <CardDescription>Update your personal information and company name</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {user?.avatar ? (
                <AvatarImage src={user.avatar} alt={user.name} />
              ) : null}
              <AvatarFallback className="bg-muted text-lg text-foreground">
                {user ? getInitials(user.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {user?.companyName || "Personal Workspace"} • {user?.role} account
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Corp / StockShift Business"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Mumbai / Bangalore"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Maharashtra"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {saveSuccess ? (
              <p className="text-xs text-emerald-600 font-semibold">
                ✓ Profile &amp; Company Name updated successfully!
              </p>
            ) : <span />}
            <Button onClick={handleSaveProfile} disabled={isSaving} size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
              {isSaving ? "Saving..." : "Save Company & Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Bell className="h-[18px] w-[18px]" />
            </div>
            <div>
              <CardTitle className="text-base">Notifications</CardTitle>
              <CardDescription>
                Choose what alerts you receive
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                label: "Low stock alerts",
                desc: "Get notified when items fall below reorder level",
              },
              {
                label: "Financial summaries",
                desc: "Weekly profit & loss digest",
              },
              {
                label: "New report available",
                desc: "When a generated report is ready to view",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="peer sr-only"
                  />
                  <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-foreground after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-background after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-foreground">
              <Palette className="h-[18px] w-[18px]" />
            </div>
            <div>
              <CardTitle className="text-base">Appearance</CardTitle>
              <CardDescription>
                Customize how the app looks
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Theme</p>
              <p className="text-xs text-muted-foreground">
                Switch between light and dark mode
              </p>
            </div>
            <Button variant="outline" size="sm" disabled>
              System default
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Organization Workspace & Team Management */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <Building2 className="h-[18px] w-[18px]" />
              </div>
              <div>
                <CardTitle className="text-base">Organization &amp; Team Members</CardTitle>
                <CardDescription>
                  Manage multi-tenant workspace, invite team members, and set RBAC roles
                </CardDescription>
              </div>
            </div>
            <Link href="/admin/settings/organization">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                Manage Team <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>
      </Card>

      {/* Security */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <Shield className="h-[18px] w-[18px]" />
            </div>
            <div>
              <CardTitle className="text-base">Security</CardTitle>
              <CardDescription>Account access and safety</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Password</p>
              <p className="text-xs text-muted-foreground">
                Last changed: Never
              </p>
            </div>
            <Button variant="outline" size="sm">
              Change password
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Two-factor authentication
              </p>
              <p className="text-xs text-muted-foreground">
                Add an extra layer of security
              </p>
            </div>
            <Button variant="outline" size="sm">
              Enable
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API Keys & Integrations */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
              <Key className="h-[18px] w-[18px]" />
            </div>
            <div>
              <CardTitle className="text-base">API Keys & POS Integration</CardTitle>
              <CardDescription>Generate API keys for external POS machines and store systems to sync inventory in real-time</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create new key */}
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="keyLabel" className="text-xs">Key Label</Label>
              <Input
                id="keyLabel"
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                placeholder="e.g. Store Counter 1"
                className="h-9 text-sm"
              />
            </div>
            <Button
              onClick={handleCreateKey}
              disabled={isCreatingKey}
              size="sm"
              className="bg-violet-600 hover:bg-violet-500 text-white font-medium"
            >
              {isCreatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate Key"}
            </Button>
          </div>

          {/* Existing keys */}
          {isLoadingKeys ? (
            <p className="text-xs text-muted-foreground">Loading keys...</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-xs text-muted-foreground">No API keys generated yet. Create one to connect your POS system.</p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((k: any) => (
                <div key={k.id} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground">{k.label}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {k.key.slice(0, 20)}...{k.key.slice(-8)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {k.is_active ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleCopyKey(k.key, k.id)}
                        >
                          {copiedKeyId === k.id ? (
                            <span className="text-emerald-600 text-xs">✓</span>
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-500 hover:text-rose-700 text-xs h-7"
                          onClick={() => handleRevokeKey(k.id)}
                        >
                          Revoke
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-rose-500 font-medium">Revoked</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Usage docs */}
          <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">How to use:</p>
            <p>Send a POST request to <code className="bg-muted px-1 rounded">your-server/api/v1/pos/checkout</code></p>
            <p>Header: <code className="bg-muted px-1 rounded">x-api-key: your-key</code></p>
            <p>Body: <code className="bg-muted px-1 rounded">{'{"items": [{"sku": "ELC-001", "quantity": 1}]}'}</code></p>
          </div>
        </CardContent>
      </Card>

      {/* Account Session & Sign Out */}
      <Card className="border-rose-200/60 bg-rose-50/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                <LogOut className="h-[18px] w-[18px]" />
              </div>
              <div>
                <CardTitle className="text-base text-rose-900">Sign Out</CardTitle>
                <CardDescription className="text-rose-700/80">
                  End your current session on this device
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-2xs hover:shadow-xs transition-all duration-200 cursor-pointer active:scale-[0.98] gap-2"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Sign Out</span>
            </Button>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
