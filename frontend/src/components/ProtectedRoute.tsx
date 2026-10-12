import type { ReactNode } from "react";
import { isAuthenticated } from "../services/auth";

interface ProtectedRouteProps {
  children: ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  if (!isAuthenticated()) {
    return null;
  }

  return <>{children}</>;
}

export default ProtectedRoute;