import { SignUp } from "@clerk/nextjs";

import { clerkAuthAppearance } from "@/components/auth/clerk-appearance";

export default function Page() {
  return (
    <div className="w-full max-w-[440px]">
      <SignUp
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl="/dashboard"
        appearance={clerkAuthAppearance}
      />
    </div>
  );
}
