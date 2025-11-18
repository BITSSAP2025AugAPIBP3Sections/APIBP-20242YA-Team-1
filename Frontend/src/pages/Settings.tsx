
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import React from 'react';
import { AlertCircle, Database, FolderOpen, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

const Settings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Configure your integrations and preferences
        </p>
      </div>

      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-6">Integrations</h2>
        
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold">Gmail</h3>
                <Badge variant="secondary">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Not Connected
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Connect your Gmail account to automatically fetch invoice attachments
              </p>
              <Button data-testid="button-connect-gmail">
                Connect Gmail
              </Button>
            </div>
          </div>

          <Separator />

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <FolderOpen className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold">Google Drive</h3>
                <Badge variant="secondary">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Not Connected
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Organize invoices into vendor-specific folders in Google Drive
              </p>
              <Button data-testid="button-connect-drive">
                Connect Google Drive
              </Button>
            </div>
          </div>

          <Separator />

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold">Google Sheets</h3>
                <Badge variant="secondary">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Not Connected
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Maintain structured invoice data in Google Sheets
              </p>
              <Button data-testid="button-connect-sheets">
                Connect Google Sheets
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-6">Preferences</h2>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive alerts for new invoices and updates
              </p>
            </div>
            <Switch data-testid="switch-email-notifications" />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Process Invoices</Label>
              <p className="text-sm text-muted-foreground">
                Automatically extract data from new invoices
              </p>
            </div>
            <Switch defaultChecked data-testid="switch-auto-process" />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Weekly Reports</Label>
              <p className="text-sm text-muted-foreground">
                Get weekly spending summaries via email
              </p>
            </div>
            <Switch data-testid="switch-weekly-reports" />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Settings;