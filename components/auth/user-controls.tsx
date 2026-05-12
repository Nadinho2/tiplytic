"use client";

import { UserButton } from "@clerk/nextjs";
import { clerkAuthAppearance } from "./clerk-appearance";

export function UserControls() {
  return (
    <UserButton
      appearance={{
        ...clerkAuthAppearance,
        elements: {
          ...clerkAuthAppearance.elements,
          avatarBox: "h-9 w-9",
        },
      }}
    />
  );
}
