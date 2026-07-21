import type { VercelRequest, VercelResponse } from "@vercel/node";
import { maakVergelijkHandler } from "../src/server/handler";

// Vercel-productie-tegenhanger van de Vite dev-middleware in vite.config.ts.
// Beide roepen dezelfde framework-agnostische maakVergelijkHandler() aan, zodat
// de server-logica niet dupliceert tussen dev en prod (of een toekomstige
// eigen Node-server).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ fout: "Alleen POST wordt ondersteund." });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body ?? {});
    const out = await maakVergelijkHandler(process.env)(body);
    res.status(200).json(out);
  } catch (e) {
    console.error("vergelijk-api fout:", e);
    res.status(500).json({ fout: e instanceof Error ? e.message : "Onbekende serverfout." });
  }
}
