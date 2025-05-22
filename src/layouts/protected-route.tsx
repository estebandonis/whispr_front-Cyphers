import { useValidateJwtToken } from "@/features/auth/queries";
import Loading from "@/features/loading";
import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [jwtToken, setJwtToken] = useState<string | undefined | null>();
  const { data: jwtTokenValid, isLoading: validating } = useValidateJwtToken(
    jwtToken || undefined
  );

  useEffect(() => {
    handleGetAccessToken();
  }, []);

  const handleGetAccessToken = () => {
    const access_token = localStorage.getItem("access_token");
    setJwtToken(access_token);
  };

  if (jwtToken === undefined || validating) {
    return <Loading />;
  }

  if (jwtToken === null || jwtTokenValid === false) {
    return <Navigate to="/" />;
  }

  return children;
}
