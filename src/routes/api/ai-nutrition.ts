import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type Profile = {
  height?: string | number;
  weight?: string | number;
  age?: string | number;
  sex?: string;
  activity?: string;
  goal?: string;
};

export const Route = createFileRoute("/api/ai-nutrition")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") || "";
        if (!authHeader.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = authHeader.slice(7).trim();
        if (!token) return new Response("Unauthorized", { status: 401 });

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Server auth not configured", { status: 500 });
        }
        const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: authErr } = await sb.auth.getClaims(token);
        if (authErr || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });

        let body: { profile?: Profile };
        try { body = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
        const p = body.profile || {};

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const systemPrompt =
          "You are a nutrition coach. Compute daily nutrition targets for an individual based on Mifflin–St Jeor BMR, activity multiplier, and their goal. Return ONLY a JSON object with numeric fields: calories (kcal/day), protein (g/day), carbs (g/day), fats (g/day), water (glasses of 250ml/day). No other text.";
        const userPrompt = `Height: ${p.height || "?"} cm
Weight: ${p.weight || "?"} kg
Age: ${p.age || "?"}
Sex: ${p.sex || "?"}
Activity level: ${p.activity || "moderate"}
Goal: ${p.goal || "maintenance"}

Return JSON: {"calories":N,"protein":N,"carbs":N,"fats":N,"water":N}`;

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
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
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const text = data.choices?.[0]?.message?.content ?? "";
        let parsed: Record<string, number> = {};
        try { parsed = JSON.parse(text); } catch {
          const m = text.match(/\{[\s\S]*\}/);
          if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
        }
        const num = (v: unknown, d: number) => {
          const n = typeof v === "string" ? parseFloat(v) : (v as number);
          return Number.isFinite(n) && n > 0 ? Math.round(n) : d;
        };
        const targets = {
          calories: num(parsed.calories, 2200),
          protein: num(parsed.protein, 130),
          carbs: num(parsed.carbs, 250),
          fats: num(parsed.fats, 70),
          water: num(parsed.water, 8),
        };
        return Response.json({ targets });
      },
    },
  },
});
