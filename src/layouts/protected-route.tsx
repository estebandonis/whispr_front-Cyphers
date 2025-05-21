import {
  useValidateJwtToken,
  useValidateGithubToken,
} from "@/features/auth/queries";
import Loading from "@/features/loading";
import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [initialTokensLoaded, setInitialTokensLoaded] = useState(false);
  const [jwtToken, setJwtToken] = useState<string | undefined>(undefined);
  const [githubToken, setGithubToken] = useState<string | undefined>(undefined);

  // Effect to load tokens from localStorage once
  useEffect(() => {
    const storedJwtToken = localStorage.getItem("jwt-token") || undefined;
    const storedGithubToken =
      localStorage.getItem("github-oauth-token") || undefined;
    setJwtToken(storedJwtToken);
    setGithubToken(storedGithubToken);
    setInitialTokensLoaded(true);
  }, []);

  const { data: jwtTokenValid, isInitialLoading: jwtTokenInitialLoading } =
    useValidateJwtToken(jwtToken);
  const {
    data: githubTokenValid,
    isInitialLoading: githubTokenInitialLoading,
  } = useValidateGithubToken(githubToken);

  // Show loading if:
  // 1. Tokens are not yet loaded from localStorage.
  // 2. JWT token query is in its initial loading phase.
  // 3. GitHub token query is in its initial loading phase.
  if (
    !initialTokensLoaded ||
    jwtTokenInitialLoading ||
    githubTokenInitialLoading
  ) {
    return <Loading />;
  }

  // If either token is validated successfully, render children.
  if (jwtTokenValid === true || githubTokenValid === true) {
    return children;
  }

  // Otherwise, navigate to the home page.
  // This covers cases where no tokens exist, or existing tokens are invalid.
  return <Navigate to="/" />;
}
