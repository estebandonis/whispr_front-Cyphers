import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Route, Routes, BrowserRouter } from "react-router";
import MainLayout from "./layouts/main-layout.tsx";
import LoginPage from "./features/auth/login.tsx";
import SignUpPage from "./features/auth/sign-up.tsx";
import ChatLayout from "./layouts/chat-layout.tsx";
import Chat from "./features/chat/Chat.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route path="/" element={<LoginPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />
          <Route path="/chat" element={<ChatLayout />}>
            <Route path="/chat/:id" element={<Chat />} />
          </Route>
        </Route>
        <Route path="*" element={<h1>Not Found</h1>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
