import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GridStartLogo } from "@/components/GridStartLogo";
import { SeriesSidebar } from "@/components/SeriesSidebar";
import { SyncDialog } from "@/components/SyncDialog";
import { MobileSeriesSheet } from "@/components/MobileSeriesSheet";
import { PwaUpdatePrompt, PwaInstallButton } from "@/components/PwaUpdatePrompt";
import Home from "@/pages/home";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import { Link } from "wouter";

function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-14 shrink-0 border-b border-border bg-card flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <MobileSeriesSheet />
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <GridStartLogo className="h-6 w-6" />
          <span className="font-display text-base font-bold tracking-tight" data-testid="text-app-name">
            GridStart
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <PwaInstallButton />
        <SyncDialog />
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme" data-testid="button-theme-toggle">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <SeriesSidebar />
        {children}
      </div>
    </div>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route
        path="/"
        component={() => (
          <AppLayout>
            <Home />
          </AppLayout>
        )}
      />
      <Route
        path="/settings"
        component={() => (
          <AppLayout>
            <Settings />
          </AppLayout>
        )}
      />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <Toaster />
          <PwaUpdatePrompt />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
