import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Pages from "./pages/Pages";
import PageDetail from "./pages/PageDetail";
import Rules from "./pages/Rules";
import Settings from "./pages/Settings";
import SettingsTaxonomy from "./pages/SettingsTaxonomy";
import Graph from "./pages/Graph";
import AuditLog from "./pages/AuditLog";
import WIZmode from "./pages/WIZmode";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pages"
              element={
                <ProtectedRoute>
                  <Pages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pages/:id"
              element={
                <ProtectedRoute>
                  <PageDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/graph"
              element={
                <ProtectedRoute>
                  <Graph />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit"
              element={
                <ProtectedRoute>
                  <AuditLog />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rules"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Rules />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/taxonomy"
              element={
                <ProtectedRoute requiredRole="admin">
                  <SettingsTaxonomy />
                </ProtectedRoute>
              }
            />
            <Route
              path="/wizmode"
              element={
                <ProtectedRoute requiredRole="admin">
                  <WIZmode />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
