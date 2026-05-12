export const clerkAuthAppearance = {
  variables: {
    colorPrimary: "#3B82F6",
    colorBackground: "#080C14",
    colorText: "#f4f4f5",
    colorTextSecondary: "#a1a1aa",
    borderRadius: "16px",
  },
  elements: {
    card: "border border-white/10 bg-white/[0.03] shadow-none",
    headerTitle: "text-foreground",
    headerSubtitle: "text-muted",
    socialButtonsBlockButton:
      "border border-white/10 bg-white/[0.02] text-foreground hover:border-[#3B82F6]/35 hover:shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_0_20px_rgba(59,130,246,0.12)]",
    dividerLine: "bg-white/10",
    dividerText: "text-muted",
    formFieldLabel: "text-muted",
    formFieldInput:
      "border border-white/10 bg-white/[0.02] text-foreground shadow-none focus:border-[#3B82F6]/55 focus:ring-2 focus:ring-[#3B82F6]/30",
    formButtonPrimary:
      "bg-[#3B82F6] text-white hover:shadow-[0_0_0_1px_rgba(59,130,246,0.6),0_0_28px_rgba(59,130,246,0.18)]",
    footerActionText: "text-muted",
    footerActionLink: "text-[#3B82F6] hover:text-[#3B82F6]/90",
    formFieldErrorText: "text-red-400",
    identityPreviewText: "text-muted",
    identityPreviewEditButton: "text-[#3B82F6] hover:text-[#3B82F6]/90",
  },
} as const;
