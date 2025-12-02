/**
 * User Management Page (God Only)
 * 
 * Allows god-level users to:
 * - View all users
 * - Invite new users with temporary password
 * - Edit user roles
 * - Deactivate users
 */

import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { usePermissions, ROLE_DISPLAY_NAMES, DisplayRole } from "@/hooks/use-permissions";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { UserPlus, Shield, Users, Copy, Check, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: string;
  active: boolean;
  created_at: string;
  invited_by: string | null;
  inviter_email?: string;
}

// Map DB roles to display roles
const DB_TO_DISPLAY: Record<string, DisplayRole> = {
  admin: "god",
  editor: "creator",
  viewer: "viewer",
};

// Map display roles back to DB roles
const DISPLAY_TO_DB: Record<DisplayRole, string> = {
  god: "admin",
  creator: "editor",
  viewer: "viewer",
};

export default function UsersPage() {
  const { canManageUsers } = usePermissions();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<DisplayRole>("viewer");
  const [tempPassword, setTempPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!canManageUsers) {
      toast.error("Access denied");
      navigate("/dashboard");
      return;
    }
    fetchUsers();
  }, [canManageUsers, navigate]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch inviter emails for users with invited_by
      const usersWithInviters = await Promise.all(
        (data || []).map(async (u) => {
          if (u.invited_by) {
            const { data: inviter } = await supabase
              .from("users")
              .select("email")
              .eq("id", u.invited_by)
              .single();
            return { ...u, inviter_email: inviter?.email };
          }
          return u;
        })
      );

      setUsers(usersWithInviters);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !tempPassword) {
      toast.error("Email and temporary password are required");
      return;
    }

    if (tempPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setCreating(true);
    try {
      // Create auth user using admin API via edge function
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: newUserEmail,
        password: tempPassword,
        options: {
          data: {
            name: newUserName || newUserEmail,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (!signUpData.user) {
        throw new Error("Failed to create user");
      }

      // Update the user's role and invited_by in the users table
      const dbRole = DISPLAY_TO_DB[newUserRole] as "admin" | "editor" | "viewer";
      const { error: updateError } = await supabase
        .from("users")
        .update({
          role: dbRole,
          invited_by: user?.id,
          name: newUserName || newUserEmail,
        })
        .eq("id", signUpData.user.id);

      if (updateError) {
        console.error("Error updating user role:", updateError);
        // Don't throw - user was created, just role update failed
      }

      // Store credentials for display
      setCreatedCredentials({
        email: newUserEmail,
        password: tempPassword,
      });

      // Reset form and show success
      setAddDialogOpen(false);
      setSuccessDialogOpen(true);
      setNewUserEmail("");
      setNewUserName("");
      setNewUserRole("viewer");
      setTempPassword("");
      
      toast.success("User created successfully");
      fetchUsers();
    } catch (error: any) {
      console.error("Error creating user:", error);
      if (error.message?.includes("already registered")) {
        toast.error("A user with this email already exists");
      } else {
        toast.error(error.message || "Failed to create user");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateRole = async (userId: string, newDisplayRole: DisplayRole) => {
    try {
      const dbRole = DISPLAY_TO_DB[newDisplayRole] as "admin" | "editor" | "viewer";
      const { error } = await supabase
        .from("users")
        .update({ role: dbRole })
        .eq("id", userId);

      if (error) throw error;
      toast.success("Role updated");
      fetchUsers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    if (userId === user?.id) {
      toast.error("You cannot deactivate yourself");
      return;
    }

    try {
      const { error } = await supabase
        .from("users")
        .update({ active: !currentActive })
        .eq("id", userId);

      if (error) throw error;
      toast.success(currentActive ? "User deactivated" : "User activated");
      fetchUsers();
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast.error("Failed to update user status");
    }
  };

  const copyCredentials = () => {
    if (createdCredentials) {
      const text = `Email: ${createdCredentials.email}\nTemporary Password: ${createdCredentials.password}`;
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Credentials copied to clipboard");
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    const displayRole = DB_TO_DISPLAY[role] || "viewer";
    switch (displayRole) {
      case "god":
        return "default";
      case "creator":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (!canManageUsers) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to manage users.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">User Management</h1>
            <p className="text-lg text-muted-foreground">
              Invite and manage users. Access is by invitation only.
            </p>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full">
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Invite New User</DialogTitle>
                <DialogDescription>
                  Create a new user account. You'll need to share the temporary password with them.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as DisplayRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="god">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          God Like
                        </div>
                      </SelectItem>
                      <SelectItem value="creator">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-orange-500" />
                          Creator
                        </div>
                      </SelectItem>
                      <SelectItem value="viewer">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          Viewer
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Temporary Password *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 6 characters"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The user will use this to log in initially and can reset it later.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateUser} disabled={creating}>
                  {creating ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Success Dialog with Credentials */}
        <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                User Created Successfully
              </DialogTitle>
              <DialogDescription>
                Copy these credentials and share them securely with the new user.
              </DialogDescription>
            </DialogHeader>
            {createdCredentials && (
              <div className="space-y-4 py-4">
                <div className="bg-muted p-4 rounded-lg space-y-2 font-mono text-sm">
                  <div>
                    <span className="text-muted-foreground">Email: </span>
                    <span className="font-semibold">{createdCredentials.email}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Password: </span>
                    <span className="font-semibold">{createdCredentials.password}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>This password is shown only once. Make sure to copy it now.</span>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuccessDialogOpen(false)}>
                Close
              </Button>
              <Button onClick={copyCredentials}>
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied!" : "Copy Credentials"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Users Table */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Users ({users.length})
            </CardTitle>
            <CardDescription>
              Manage user accounts and permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className={!u.active ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>{u.name || "-"}</TableCell>
                    <TableCell>
                      <Select
                        value={DB_TO_DISPLAY[u.role] || "viewer"}
                        onValueChange={(v) => handleUpdateRole(u.id, v as DisplayRole)}
                        disabled={u.id === user?.id}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="god">God Like</SelectItem>
                          <SelectItem value="creator">Creator</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.active ? "default" : "destructive"} className="rounded-full">
                        {u.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.inviter_email || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(u.created_at), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      {u.id !== user?.id && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              {u.active ? "Deactivate" : "Activate"}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {u.active ? "Deactivate" : "Activate"} User?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {u.active
                                  ? "This will prevent the user from logging in."
                                  : "This will allow the user to log in again."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleToggleActive(u.id, u.active)}>
                                {u.active ? "Deactivate" : "Activate"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {u.id === user?.id && (
                        <span className="text-xs text-muted-foreground">You</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
