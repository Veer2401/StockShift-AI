"use client";

import { useState } from "react";
import { useAuth } from "@/_lib/auth-context";
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
import { Building2, Users, UserPlus, Shield, Mail, CheckCircle2, Trash2 } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "Owner / Admin" | "Warehouse Manager" | "Accountant";
  status: "Active" | "Pending";
}

export default function OrganizationSettingsPage() {
  const { user, updateProfile } = useAuth();

  const [companyName, setCompanyName] = useState(user?.companyName || "");
  const [city, setCity] = useState(user?.city || "");
  const [state, setState] = useState(user?.state || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(
    user
      ? [
          {
            id: user.id,
            name: user.name || "Workspace Admin",
            email: user.email || "admin@company.com",
            role: "Owner / Admin",
            status: "Active",
          },
        ]
      : []
  );

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamMember["role"]>("Warehouse Manager");
  const [inviteSent, setInviteSent] = useState(false);

  const handleSaveOrganization = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await updateProfile({
        companyName,
        city,
        state,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update organization:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendInvite = () => {
    if (!inviteEmail.trim()) return;

    const newMember: TeamMember = {
      id: `m-${Date.now()}`,
      name: inviteEmail.split("@")[0],
      email: inviteEmail,
      role: inviteRole,
      status: "Pending",
    };

    setTeamMembers([...teamMembers, newMember]);
    setInviteSent(true);
    setTimeout(() => {
      setInviteSent(false);
      setIsInviteOpen(false);
      setInviteEmail("");
    }, 1200);
  };

  const handleRemoveMember = (id: string) => {
    if (!confirm("Are you sure you want to revoke workspace access for this member?")) return;
    setTeamMembers(teamMembers.filter((m) => m.id !== id));
  };

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground sm:text-3xl">
            <Building2 className="w-8 h-8 text-emerald-600" />
            Organization &amp; Team Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage multi-tenant company settings, edit company name, invite team members, and assign role permissions.
          </p>
        </div>
        <Button onClick={() => setIsInviteOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
          <UserPlus className="w-4 h-4 mr-2" /> Invite Team Member
        </Button>
      </div>

      {/* Organization Details Form */}
      <Card className="border-border/60 shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            Company Workspace Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Company Name *</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter Company / Business Name"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">City</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Mumbai"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">State</Label>
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Maharashtra"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            {saveSuccess ? (
              <p className="text-xs text-emerald-600 font-semibold">
                ✓ Company Name updated successfully!
              </p>
            ) : <span />}
            <Button
              onClick={handleSaveOrganization}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shrink-0"
            >
              {isSaving ? "Saving..." : "Update Company Name"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Team Members List */}
      <Card className="border-border/60 shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              Team Members ({teamMembers.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3.5 rounded-lg border border-border/60 bg-muted/20 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center text-sm shrink-0">
                    {member.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                      {member.name}
                      <Badge
                        variant="secondary"
                        className={
                          member.role === "Owner / Admin"
                            ? "bg-emerald-50 text-emerald-600 border-0"
                            : member.role === "Warehouse Manager"
                            ? "bg-blue-50 text-blue-600 border-0"
                            : "bg-amber-50 text-amber-600 border-0"
                        }
                      >
                        {member.role}
                      </Badge>
                    </h4>
                    <p className="text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3 text-slate-400" /> {member.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={member.status === "Active" ? "border-emerald-500/30 text-emerald-600" : "border-amber-500/30 text-amber-600"}
                  >
                    {member.status}
                  </Badge>
                  {member.role !== "Owner / Admin" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500" onClick={() => handleRemoveMember(member.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invite Member Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Invite Team Member to Workspace</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-3 text-sm">
            <div className="space-y-1">
              <Label>Teammate Email Address *</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
              />
            </div>

            <div className="space-y-1">
              <Label>Assign Workspace Role (RBAC)</Label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="Warehouse Manager">Warehouse Manager (Stock Entry &amp; Transfers)</option>
                <option value="Accountant">Accountant (Costs &amp; Purchase Orders)</option>
                <option value="Owner / Admin">Owner / Admin (Full Access)</option>
              </select>
            </div>

            {inviteSent && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Invitation link sent to {inviteEmail}!
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendInvite} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
              Send Email Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
