import Loading from "@/features/loading";
import { useCurrentUser } from "@/features/user/queries";
import { ReactNode } from "react";
import { Navigate } from "react-router";

interface ProtectedRouteProps {
  readonly children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const {
    data: user,
    isLoading: loadingUser,
    error: errorUser,
  } = useCurrentUser();

  if (loadingUser) {
    return <Loading />;
  }

  if (errorUser || !user) {
    return <Navigate to="/" />;
  }

  return children;
}
