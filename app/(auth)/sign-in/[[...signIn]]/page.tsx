import { SignIn } from "@clerk/nextjs";

import { clerkAuthAppearance } from "@/components/auth/clerk-appearance";

export default function Page() {
  return (
    <div className="w-full max-w-[440px]">
      <SignIn
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/dashboard"
        appearance={clerkAuthAppearance}
      />
    </div>
  );
}
