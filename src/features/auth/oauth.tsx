import { ChevronLeft, Github, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { useGithubOAuthLogin } from "./queries";

export default function OAuth() {
  const {
    mutateAsync: loginWithGithubOAuth,
    isPending: loggingIn,
    error,
  } = useGithubOAuthLogin();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oauthInitiated = useRef(false);

  const handleOAuth = useCallback(
    async (code: string) => {
      // Prevent multiple OAuth attempts
      if (oauthInitiated.current) return;
      oauthInitiated.current = true;
      console.log("Starting OAuth with code:", code);

      try {
        const result = await loginWithGithubOAuth(code);

        localStorage.setItem("access_token", result.access_token);
        localStorage.setItem("refresh_token", result.refresh_token);
        toast.success("Logged in with GitHub");
        navigate("/chat");
      } catch (error) {
        console.log("OAuth error:", error);
        // Reset the flag on error so user can retry if needed
        oauthInitiated.current = false;

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
      }
    },
    [loginWithGithubOAuth, navigate]
  );

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) return;

    handleOAuth(code);
  }, [handleOAuth, searchParams]);

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
