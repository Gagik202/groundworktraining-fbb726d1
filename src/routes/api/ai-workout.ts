import { createFileRoute } from "@tanstack/react-router";

type Body = { systemPrompt?: string; userPrompt?: string };

export const Route = createFileRoute("/api/ai-workout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const systemPrompt = (body.systemPrompt || "").toString();
        const userPrompt = (body.userPrompt || "").toString();
        if (!userPrompt) return new Response("Missing userPrompt", { status: 400 });

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          return new Response(`AI gateway ${res.status}: ${txt}`, { status: res.status });
        }
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = data.choices?.[0]?.message?.content ?? "";
        return Response.json({ text });
      },
    },
  },
});
