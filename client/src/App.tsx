import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarNav } from "@/components/sidebar-nav";
import { SuggestionBox } from "@/components/suggestion-box";
import { usePageViewTracker } from "@/hooks/use-analytics";
import NotFound from "@/pages/not-found";
// Legacy pages (still accessible via direct URL)
import Dashboard from "@/pages/dashboard";
import Meetings from "@/pages/meetings";
import News from "@/pages/news";
import Briefing from "@/pages/briefing";
import Developments from "@/pages/developments";
import Engagement from "@/pages/engagement";
import StateRadar from "@/pages/state-radar";
// New civic pulse pages
import Today from "@/pages/today";
import WhatChanged from "@/pages/what-changed";
import FeedbackOpportunities from "@/pages/feedback-opportunities";
import DevelopPosition from "@/pages/develop-position";
import DraftResponse from "@/pages/draft-response";
import Monitoring from "@/pages/monitoring";
import SourceTrail from "@/pages/source-trail";
import Calendar from "@/pages/calendar";

function AppRouter() {
  return (
    <Switch>
      {/* New civic pulse routes */}
      <Route path="/" component={Today} />
      <Route path="/changed" component={WhatChanged} />
      <Route path="/feedback" component={FeedbackOpportunities} />
      <Route path="/position/:id" component={DevelopPosition} />
      <Route path="/draft" component={DraftResponse} />
      <Route path="/monitoring" component={Monitoring} />
      <Route path="/sources" component={SourceTrail} />
      <Route path="/calendar" component={Calendar} />
      {/* Legacy routes — still accessible */}
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/meetings" component={Meetings} />
      <Route path="/news" component={News} />
      <Route path="/developments" component={Developments} />
      <Route path="/engagement" component={Engagement} />
      <Route path="/state-radar" component={StateRadar} />
      <Route path="/briefing" component={Briefing} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AnalyticsWrapper({ children }: { children: React.ReactNode }) {
  usePageViewTracker();
  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AnalyticsWrapper>
            <div className="flex h-screen overflow-hidden">
              <SidebarNav />
              <main className="flex-1 overflow-auto pt-12 md:pt-0">
                <AppRouter />
              </main>
            </div>
            <SuggestionBox />
          </AnalyticsWrapper>
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
