"use client";

import { loader } from "@monaco-editor/react";

let configurePromise: Promise<void> | null = null;

/**
 * Default @monaco-editor/react loads editor assets from a CDN. This app's
 * Next.js CSP only allows same-origin scripts, so that fetch is blocked and
 * the editor stays on "Loading..." forever. Wire the loader to the bundled
 * `monaco-editor` npm package instead.
 *
 * Tauri applies its own CSP in `src-tauri/tauri.conf.json`. Monaco language
 * workers often run as `blob:`/`data:` workers — `worker-src` must allow those
 * in both places or the WebView can hang like the browser did with CDN scripts.
 *
 * @see https://github.com/suren-atoyan/monaco-loader#configure-the-loader-to-load-the-monaco-as-an-npm-package
 * @see https://v2.tauri.app/security/csp/
 */
export function ensureMonacoConfigured(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (!configurePromise) {
    const init = (async () => {
      const monaco = await import("monaco-editor");
      loader.config({ monaco });
    })();
    configurePromise = init.catch((err: unknown) => {
      configurePromise = null;
      throw err;
    });
  }
  return configurePromise;
}

/** Clears loader state so `ensureMonacoConfigured` can be retried after a failure. */
export function resetMonacoConfiguration(): void {
  configurePromise = null;
}
