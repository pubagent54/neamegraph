/**
 * App Shell Layout Component
 * 
 * Provides consistent header, navigation, and user controls across all pages.
 * Navigation items filtered by user role (admin sees Rules and Settings).
 * Features: prominent NeameGraph logo, role badge, dark mode toggle, sign out dropdown.
 */

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, LayoutDashboard, FileText, Settings, GitBranch, Activity, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import neameGraphLogo from "@/assets/neamegraph-logo.png";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, userRole, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, color: "text-blue-500" },
    { path: "/pages", label: "Pages", icon: FileText, color: "text-green-500" },
    { path: "/graph", label: "Graph", icon: GitBranch, color: "text-purple-500" },
    { path: "/audit", label: "Audit Log", icon: Activity, color: "text-orange-500" },
    ...(userRole === "admin"
      ? [
          { path: "/rules", label: "Rules", icon: Shield, color: "text-red-500" },
          { path: "/settings", label: "Settings", icon: Settings, color: "text-gray-500" },
        ]
      : []),
  ];

  const roleColors = {
    admin: "bg-primary text-primary-foreground",
    editor: "bg-status-review text-white",
    viewer: "bg-muted text-muted-foreground",
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-12 py-6">
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-20">
              <Link to="/dashboard" className="flex items-center transition-transform hover:scale-105">
                <img src={neameGraphLogo} alt="NeameGraph powered by PubAgent" className="h-36 w-auto" />
              </Link>
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link key={item.path} to={item.path}>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        size="sm"
                        className={`gap-2 rounded-full ${isActive ? 'shadow-sm' : ''}`}
                      >
                        <Icon className={`h-4 w-4 ${item.color}`} />
                        {item.label}
                      </Button>
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 rounded-full">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{user?.email}</span>
                  {userRole && (
                    <Badge className={`${roleColors[userRole as keyof typeof roleColors]} rounded-full`}>
                      {userRole}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="rounded-lg">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
