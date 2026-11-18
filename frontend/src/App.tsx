import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/context/AppContext";
import Layout from "@/components/Layout";
import ChatPage from "@/pages/ChatPage";
import VisionPage from "@/pages/VisionPage";
import ContactsPage from "@/pages/ContactsPage";
import MyContactsPage from "@/pages/MyContactsPage";
import LoginPage from "@/pages/LoginPage";
import AuthCallback from "@/components/AuthCallback";
import { LandingPage } from "@/components/LandingPage";

function LandingRoute() {
  const { authState } = useApp();
  const navigate = useNavigate();
  if (authState === "checking") {
    return (
      <div className="min-h-screen bg-j-main flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-j-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (authState === "in") return <Navigate to="/chat" replace />;
  return <LandingPage onEnter={() => navigate("/login")} />;
}

function Guard({ children }: { children: React.ReactNode }) {
  const { authState } = useApp();
  if (authState === "checking") {
    return (
      <div className="min-h-screen bg-j-main flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-j-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (authState === "out") return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AppProvider>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingRoute />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route
              path="/chat"
              element={
                <Guard>
                  <Layout />
                </Guard>
              }
            >
              <Route index element={<ChatPage />} />
              <Route path="c/:convId" element={<ChatPage />} />
              <Route path="vision" element={<VisionPage />} />
              <Route path="contacts" element={<ContactsPage />} />
              <Route path="my-contacts" element={<MyContactsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="bottom-right" theme="dark" richColors />
      </TooltipProvider>
    </AppProvider>
  );
}
