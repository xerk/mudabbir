"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Root error boundary. This replaces the root layout entirely, so next-intl /
// theme / font providers are NOT available here. Keep it self-contained: render
// our own <html>/<body>, plain English copy, and inline styles only.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" dir="ltr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          background: "#ffffff",
          color: "#0a0a0a",
        }}
      >
        <span
          style={{
            display: "flex",
            width: "3rem",
            height: "3rem",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "0.75rem",
            border: "1px solid rgba(124, 58, 237, 0.2)",
            background: "rgba(124, 58, 237, 0.1)",
            color: "#7c3aed",
            fontSize: "1.5rem",
          }}
        >
          ◆
        </span>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "1.25rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: "28rem",
              fontSize: "0.875rem",
              color: "#737373",
            }}
          >
            An unexpected error occurred. Please reload the page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "2.25rem",
            padding: "0 1rem",
            borderRadius: "0.375rem",
            border: "none",
            background: "#7c3aed",
            color: "#ffffff",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
