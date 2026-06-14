"use client";

import React, { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface InteractiveHoverButtonProps {
  text?: string;
  loadingText?: string;
  successText?: string;
  className?: string;
  onClick?: () => void | boolean | Promise<void | boolean>;
  disabled?: boolean;
}

export default function InteractiveHoverButton({
  text = "Button",
  loadingText = "Processing...",
  successText = "Complete!",
  className,
  onClick,
  disabled,
  ...props
}: InteractiveHoverButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

  const isIdle = status === "idle";

  const handleClick = async () => {
    if (status !== "idle" || disabled) return;

    setStatus("loading");
    try {
      const result = await onClick?.();
      // If onClick returns false explicitly, treat as failure
      if (result === false) {
        setStatus("idle");
      } else {
        setStatus("success");
        setTimeout(() => setStatus("idle"), 3000);
      }
    } catch {
      setStatus("idle");
    }
  };

  return (
    <motion.button
      type="button"
      className={cn(
        "group bg-background relative flex min-w-40 items-center justify-center overflow-hidden rounded-full border p-2 px-6 font-semibold",
        status === "loading" && "px-2",
        className,
      )}
      onClick={handleClick}
      disabled={disabled}
      layout
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      {...props}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key="idle"
          className="flex items-center gap-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <div
            className={cn(
              "bg-primary absolute inset-0 origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100",
              !isIdle && "scale-x-100",
            )}
          />
          <span
            className={cn(
              "relative z-10 inline-block transition-all duration-500 group-hover:opacity-0",
              !isIdle && "opacity-0",
            )}
          >
            {text}
          </span>
          <div
            className={cn(
              "text-primary-foreground absolute inset-0 z-20 flex items-center justify-center gap-2 opacity-0 transition-all duration-500 group-hover:opacity-100",
              !isIdle && "opacity-100",
            )}
          >
            {status === "idle" ? (
              <>
                <span>{text}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            ) : status === "loading" ? (
              <>
                <div className="border-primary border-t-background h-4 w-4 animate-spin rounded-full border-2" />
                <span className="text-background">{loadingText}</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>{successText}</span>
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.button>
  );
}
