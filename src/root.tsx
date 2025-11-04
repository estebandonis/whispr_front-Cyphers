import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Route, Routes, BrowserRouter } from "react-router";
import MainLayout from "./layouts/main-layout.tsx";
import LoginPage from "./features/auth/login.tsx";
import SignUpPage from "./features/auth/sign-up.tsx";
import ChatLayout from "./layouts/chat-layout.tsx";
import Chat from "./features/chat/index.tsx";
import OAuth from "./features/auth/oauth.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import ProtectedRoute from "./layouts/protected-route.tsx";
import MfaVerify from "@/features/auth/mfa-verify.tsx";
import MfaSetup from "@/features/auth/mfa-setup.tsx";

export const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route path="/" element={<LoginPage />} />
            <Route path="/sign-up" element={<SignUpPage />} />
            <Route path="/oauth-callback" element={<OAuth />} />
            <Route path="/mfa">
              <Route path="/mfa/verify" element={<MfaVerify />} />
              <Route
                path="/mfa/setup"
                element={
                  <ProtectedRoute>
                    <MfaSetup />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <ChatLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/chat/:id/:group" element={<Chat />} />
            </Route>
          </Route>
          <Route path="*" element={<h1>Not Found</h1>} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
