import { createFileRoute } from "@tanstack/react-router";
import html from "../groundwork.html?raw";

function inject(): string {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || "";
  const snippet = `<script>window.__GW_ENV=${JSON.stringify({ SUPABASE_URL: url, SUPABASE_KEY: key })};</script>`;
  // Inject right after <head> so it's defined before any in-page script runs.
  return html.replace(/<head>/i, `<head>${snippet}`);
}

export const Route = createFileRoute("/")({
  server: {
    handlers: {
      GET: async () =>
        new Response(inject(), {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          },
        }),
    },
  },
  component: () => null,
});
