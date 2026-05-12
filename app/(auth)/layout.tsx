import type { ReactNode } from "react";

import { Container } from "@/components/ui/container";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-full flex-col overflow-hidden bg-[#080C14]">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-260px] h-[540px] w-[940px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.18),rgba(59,130,246,0)_62%)]" />
      </div>
      <Container className="flex flex-1 items-center justify-center py-10">
        {children}
      </Container>
    </div>
  );
}
