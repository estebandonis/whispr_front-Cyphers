import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NavLink, useNavigate } from "react-router";
import CornerAccents from "@/components/corner-accents";
import { Github } from "lucide-react";
import {
  useLogin,
  useValidateGithubToken,
  useValidateJwtToken,
} from "./queries";
import { toast } from "sonner";
import { useEffect, useState } from "react";

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [jwtToken, setJwtToken] = useState<string | undefined>(undefined);
  const [githubToken, setGithubToken] = useState<string | undefined>(undefined);

  // Effect to load tokens from localStorage once
  useEffect(() => {
    const storedJwtToken = localStorage.getItem("jwt-token") || undefined;
    const storedGithubToken =
      localStorage.getItem("github-oauth-token") || undefined;
    setJwtToken(storedJwtToken);
    setGithubToken(storedGithubToken);
  }, []);

  const { data: jwtTokenValid } = useValidateJwtToken(jwtToken);
  const { data: githubTokenValid } = useValidateGithubToken(githubToken);

  useEffect(() => {
    if (jwtTokenValid) {
      navigate("/chat");
    } else if (githubTokenValid) {
      navigate("/chat");
    }
  }, [jwtTokenValid, githubTokenValid]);

  const { mutate: login, isPending: loggingIn } = useLogin();
  const navigate = useNavigate();

  const handleLogin = () => {
    login(
      { email, password },
      {
        onSuccess: (token) => {
          localStorage.setItem("jwt-token", token);
          toast.success("Logged in");
          navigate("/chat");
        },
        onError: (error) => {
          let errorMessage = "An unexpected error occurred.";
          if (
            error &&
            typeof error === "object" &&
            "response" in error &&
            error.response &&
            typeof error.response === "object" &&
            "data" in error.response &&
            error.response.data &&
            typeof error.response.data === "object" &&
            "error" in error.response.data
          ) {
            errorMessage = (error.response.data as { error: string }).error;
          }
          toast.error("Error logging in", {
            description: errorMessage,
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
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loggingIn}
          type="email"
        />
        <Input
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loggingIn}
          type="password"
        />
        <Button
          asChild
          className="uppercase cursor-pointer font-medium"
          disabled={loggingIn}
        >
          <button onClick={handleLogin}>Sign in</button>
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
