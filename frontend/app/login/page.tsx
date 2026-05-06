import { Suspense } from "react";
import { LoginPageComponent } from "@/components/auth/login-page";

export const metadata = {
  title: "Sign In — BothSafe",
  description: "Sign in to BothSafe to create and manage protected deal rooms.",
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageComponent />
    </Suspense>
  );
}
