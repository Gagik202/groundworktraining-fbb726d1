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
          "You are a nutrition and training coach. Compute daily nutrition targets using Mifflin–St Jeor BMR × activity multiplier, then adjust calories for the goal (fat loss ≈ -20%, muscle gain ≈ +10%, maintenance/endurance ≈ 0). Also estimate how many weeks of consistent adherence until visible body composition changes (typically 3–6 wk for fat loss noticeable in clothes, 6–12 wk visible muscle, 2–4 wk for endurance gains). Return ONLY a JSON object: calories (kcal/day, int), protein (g/day, int), carbs (g/day, int), fats (g/day, int), water (glasses of 250ml/day, int), timeToResultsWeeks (int), timeToResultsNote (short string ≤90 chars, e.g. 'Visible fat loss in ~4 weeks at 0.5kg/week deficit'). No other text.";
        const userPrompt = `Height: ${p.height || "?"} cm
Weight: ${p.weight || "?"} kg
Age: ${p.age || "?"}
Sex: ${p.sex || "?"}
Activity level: ${p.activity || "moderate"}
Goal: ${p.goal || "maintenance"}

Return JSON: {"calories":N,"protein":N,"carbs":N,"fats":N,"water":N,"timeToResultsWeeks":N,"timeToResultsNote":"..."}`;

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
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(text); } catch {
          const m = text.match(/\{[\s\S]*\}/);
          if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
        }
        const num = (v: unknown, d: number) => {
          const n = typeof v === "string" ? parseFloat(v) : (v as number);
          return Number.isFinite(n) && n > 0 ? Math.round(n) : d;
        };
        const str = (v: unknown, d: string) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 140) : d);
        const goal = (p.goal || "maintenance").toString().toLowerCase();
        const defaultWeeks = goal.includes("fat") ? 4 : goal.includes("muscle") ? 8 : goal.includes("endur") ? 3 : 6;
        const defaultNote = goal.includes("fat")
          ? "Visible fat loss in ~4 weeks with consistent adherence."
          : goal.includes("muscle")
            ? "Noticeable muscle gain in ~8 weeks with progressive overload."
            : goal.includes("endur")
              ? "Endurance gains usually felt within 2–4 weeks."
              : "Body recomposition typically visible in 6–8 weeks.";
        const targets = {
          calories: num(parsed.calories, 2200),
          protein: num(parsed.protein, 130),
          carbs: num(parsed.carbs, 250),
          fats: num(parsed.fats, 70),
          water: num(parsed.water, 8),
          timeToResultsWeeks: num(parsed.timeToResultsWeeks, defaultWeeks),
          timeToResultsNote: str(parsed.timeToResultsNote, defaultNote),
        };
        return Response.json({ targets });
      },
    },
  },
});
