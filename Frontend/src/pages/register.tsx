import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

/** Legacy route — progressive one-field setup lives at /welcome. */
export default function Register() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    setLocation(
      isAuthenticated
        ? "/welcome?next=%2Fdashboard%2Fprofile"
        : "/login?redirect=%2Fwelcome%3Fnext%3D%252Fdashboard%252Fprofile",
    );
  }, [isAuthenticated, setLocation]);

  return null;
}
