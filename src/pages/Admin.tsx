import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, LayoutDashboard, Users, Palette, Settings, Activity, MessageSquare, Mail, Wrench } from "lucide-react";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminDesign } from "@/components/admin/AdminDesign";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { AdminAdvanced } from "@/components/admin/AdminAdvanced";
import { AdminFeedback } from "@/components/admin/AdminFeedback";
import { AdminContacts } from "@/components/admin/AdminContacts";
import { AdminLogs } from "@/components/admin/AdminLogs";
import { Logo } from "@/components/Logo";

const Admin = () => {
  const { user, profile, loading, signOut, isAdmin } = useFirebaseAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Logo className="h-10 w-auto" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Admin Panel
                </h1>
                <p className="text-sm text-muted-foreground">
                  Manage your photo gallery system
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={signOut}
              className="border-border hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 gap-2 bg-card/50 p-2">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="design" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Design</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Advanced</span>
            </TabsTrigger>
            <TabsTrigger value="feedback" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Feedback</span>
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Contacts</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Logs</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <AdminDashboard />
          </TabsContent>

          <TabsContent value="users">
            <AdminUsers />
          </TabsContent>

          <TabsContent value="design">
            <AdminDesign />
          </TabsContent>

          <TabsContent value="settings">
            <AdminSettings />
          </TabsContent>

          <TabsContent value="advanced">
            <AdminAdvanced />
          </TabsContent>

          <TabsContent value="feedback">
            <AdminFeedback />
          </TabsContent>

          <TabsContent value="contacts">
            <AdminContacts />
          </TabsContent>

          <TabsContent value="logs">
            <AdminLogs />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
