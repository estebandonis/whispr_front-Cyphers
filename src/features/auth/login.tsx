import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NavLink, useNavigate } from "react-router";
import CornerAccents from "@/components/corner-accents";
import { Github, Loader2 } from "lucide-react";
import { useLogin } from "./queries";
import { toast } from "sonner";
import { useState } from "react";

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID;

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { mutate: login, isPending: loggingIn } = useLogin();
  const navigate = useNavigate();

  const handleLogin = () => {
    if (!username.trim() || !password.trim()) {
      toast.error("Missing fields");
      return;
    }

    login(
      { username, password },
      {
        onSuccess: ({ success, message, mfa, userId }) => {
          if (mfa && userId) {
            navigate(`/mfa/verify?userId=${userId}`);
            return;
          }

          if (success) {
            toast.success(message || "Logged in successfully");
            navigate("/chat");
          } else {
            toast.error("Error logging in");
          }
        },
        onError: (error) => {
          toast.error("Error logging in", {
            description: error.message,
          });
        },
      }
    );
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full ">
      <div className="animate-scale-in relative w-full max-w-md flex flex-col gap-4 bg-neutral-900 p-4 border border-neutral-800 ">
        <CornerAccents />
        <h1 className="text-2xl text-neutral-200 uppercase font-heading">
          Whispr
        </h1>
        <Input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loggingIn}
          type="text"
        />
        <Input
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loggingIn}
          type="password"
        />
        <Button asChild className="uppercase cursor-pointer font-medium">
          <button onClick={handleLogin} disabled={loggingIn}>
            {loggingIn ? (
              <Loader2 className="animate-spin size-4" />
            ) : (
              "Sign in"
            )}
          </button>
        </Button>
        {/* Github OAuth 2 login */}
        <div className="flex items-center justify-center">
          <div className="border-t border-neutral-800 flex-grow"></div>
          <p className="text-neutral-400 text-xs text-center mx-2">or</p>
          <div className="border-t border-neutral-800 flex-grow"></div>
        </div>
        <Button
          asChild
          className="uppercase cursor-pointer font-medium bg-black hover:bg-neutral-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loggingIn}
        >
          <NavLink
            to={
              !loggingIn
                ? `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}`
                : ""
            }
            className={`text-white ${
              loggingIn ? "cursor-not-allowed opacity-50" : ""
            }`}
          >
            Continue with <Github className="size-4 text-white" />
          </NavLink>
        </Button>
        <p className="text-neutral-400 text-xs text-center">
          <NavLink to={!loggingIn ? "/sign-up" : ""} viewTransition>
            I'm new here,{" "}
            <span className="text-white hover:underline">Sign up</span>
          </NavLink>
        </p>
      </div>
    </div>
  );
}
