// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

// Drop errors originating from browser extensions (MetaMask's inpage.js,
// injected widgets, etc.) by matching their URL scheme.
const sharedSentryOptions = {
  debug: false,
  denyUrls: [
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-extension:\/\//i,
    /^safari-web-extension:\/\//i,
  ],
};

// Initialize Sentry - prioritize NEXT_PUBLIC env vars, fallback to API
const initSentry = () => {
  const hasPublicConfig = process.env.NEXT_PUBLIC_SENTRY_DSN;


  if (hasPublicConfig) {
    // Use client-side environment variables
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      ...sharedSentryOptions,
    });
    console.log('Sentry initialized from NEXT_PUBLIC config');
  } else {
    // Fallback to API-based configuration
    fetch('/api/config/sentry')
      .then(res => res.json())
      .then(config => {
        if (config.enabled && config.dsn) {
          Sentry.init({
            dsn: config.dsn,
            ...sharedSentryOptions,
          });
          console.log('Sentry initialized from API config');
        } else {
          console.log('Sentry disabled (not enabled or DSN not configured)');
        }
      })
      .catch(err => {
        console.error('Failed to fetch Sentry configuration:', err);
      });
  }
};

if (process.env.NEXT_PUBLIC_NODE_ENV !== 'development') {
  initSentry();
}

// Initialize PostHog - prioritize NEXT_PUBLIC env vars, fallback to API
const initPostHog = () => {
  // PostHog is OFF unless you explicitly provide your OWN key via
  // NEXT_PUBLIC_POSTHOG_KEY. The previous API-config fallback auto-enabled
  // analytics using the upstream Dograh key — that's intentionally removed so
  // no telemetry is sent from this deployment by default.
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    console.log('PostHog disabled (set NEXT_PUBLIC_POSTHOG_KEY to enable)');
    return;
  }

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || '/ingest',
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || 'https://us.posthog.com',
    capture_pageview: 'history_change',
    capture_pageleave: true,
    capture_exceptions: true,
    cross_subdomain_cookie: true,
    debug: process.env.NEXT_PUBLIC_NODE_ENV === 'development',
  });
  console.log('PostHog initialized from NEXT_PUBLIC config');
};

if (process.env.NEXT_PUBLIC_NODE_ENV !== 'development') {
  initPostHog();
}


export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
