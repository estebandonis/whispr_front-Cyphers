import { useEffect, useState } from "react";
import Loading from "../loading";
import { Loader2, Github, ChevronLeft } from "lucide-react";
import { NavLink, useNavigate } from "react-router";
import { useGithubOAuthLogin } from "./queries";
import { toast } from "sonner";

export default function OAuth() {
  const {
    mutate: loginWithGithubOAuth,
    isPending: loggingIn,
    error,
  } = useGithubOAuthLogin();
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // get the /path/oauth-callback?code=...
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;

    handleOAuth(code);
  }, []);

  const handleOAuth = async (code: string) => {
    setLoading(false);
    loginWithGithubOAuth(code, {
      onSuccess: (token) => {
        localStorage.setItem("github-oauth-token", token);
        toast.success("Logged in with GitHub");
        navigate("/chat");
      },
      onError: (error) => {
        // console.log("error:", error);
        let errorMessage =
          "An unexpected error occurred during GitHub authentication.";
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
        toast.error("Error authenticating with GitHub", {
          description: errorMessage,
        });
      },
    });
  };

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <article className="w-full h-full flex items-center justify-center flex-col gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Error authenticating with GitHub <Github className="size-8" />
        </h1>
        <p className="text-sm text-neutral-400 flex items-center gap-2">
          {error.message}
        </p>
        <NavLink
          to="/"
          className="text-sm text-neutral-400 hover:underline flex items-center gap-2"
        >
          <ChevronLeft className="size-4" />
          Go back
        </NavLink>
      </article>
    );
  }

  return (
    <article className="w-full h-full flex items-center justify-center flex-col gap-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        {loggingIn ? "Authenticating with GitHub" : "Authenticated with GitHub"}{" "}
        <Github className="size-8" />
      </h1>
      {loggingIn && (
        <p className="text-sm text-neutral-400 flex items-center gap-2">
          Logging in... <Loader2 className="size-4 animate-spin" />
        </p>
      )}
    </article>
  );
}
