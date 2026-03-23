import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarNav } from "@/components/sidebar-nav";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import MapView from "@/pages/map-view";
import Meetings from "@/pages/meetings";
import News from "@/pages/news";
import Briefing from "@/pages/briefing";
import Developments from "@/pages/developments";
import Calendar from "@/pages/calendar";
import Engagement from "@/pages/engagement";
import StateRadar from "@/pages/state-radar";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/map" component={MapView} />
      <Route path="/meetings" component={Meetings} />
      <Route path="/news" component={News} />
      <Route path="/developments" component={Developments} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/engagement" component={Engagement} />
      <Route path="/state-radar" component={StateRadar} />
      <Route path="/briefing" component={Briefing} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <div className="flex h-screen overflow-hidden">
            <SidebarNav />
            <main className="flex-1 overflow-auto pt-12 md:pt-0">
              <AppRouter />
            </main>
          </div>
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
