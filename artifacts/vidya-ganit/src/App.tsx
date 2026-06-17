import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { LanguageProvider } from "@/lib/i18n";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Auth from "@/pages/Auth";
import Success from "@/pages/Success";
import ForgotPassword from "@/pages/ForgotPassword";
import StudentDashboard from "@/pages/StudentDashboard";
import ParentDashboard from "@/pages/ParentDashboard";
import TutorDashboard from "@/pages/TutorDashboard";
import Header from "@/components/layout/Header";

const queryClient = new QueryClient();

function Router() {
  return (
    <div className="flex flex-col min-h-[100dvh]">
      <Header />
      <main className="flex-1 flex flex-col mt-16">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/auth" component={Auth} />
          <Route path="/success" component={Success} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/dashboard/student" component={StudentDashboard} />
          <Route path="/dashboard/parent" component={ParentDashboard} />
          <Route path="/dashboard/tutor" component={TutorDashboard} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <LanguageProvider>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </LanguageProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
