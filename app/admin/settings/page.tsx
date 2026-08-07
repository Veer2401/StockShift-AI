"use client";

import { useState } from "react";
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
import { User, Bell, Shield, Palette, Building2, ArrowRight } from "lucide-react";
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
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [companyName, setCompanyName] = useState(user?.companyName ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [state, setState] = useState(user?.state ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
    </div>
  );
}
