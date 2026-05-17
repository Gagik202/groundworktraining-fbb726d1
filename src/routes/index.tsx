import { createFileRoute } from "@tanstack/react-router";
import landingHtml from "../landing.html?raw";

export const Route = createFileRoute("/")({
  server: {
    handlers: {
      GET: async () =>
        new Response(landingHtml, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          },
        }),
    },
  },
  component: () => null,
});
