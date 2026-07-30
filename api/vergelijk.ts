import { maakVergelijkHandler } from "../src/server/handler";

// Minimale handler-typen — vervangt de zware devDependency @vercel/node (met een
// grote transitieve kwetsbaarheden-tree). Vercel injecteert zijn eigen runtime;
// deze typen zijn puur compile-time en dekken exact wat we hier gebruiken.
interface VercelRequest {
  method?: string;
  body?: unknown;
}
interface VercelResponse {
  status(code: number): VercelResponse;
  json(body: unknown): void;
}

// Vercel-productie-tegenhanger van de Vite dev-middleware in vite.config.ts.
// Beide roepen dezelfde framework-agnostische maakVergelijkHandler() aan.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ fout: "Alleen POST wordt ondersteund." });
    return;
  }
  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body ?? {});
    const out = await maakVergelijkHandler(process.env)(body);
    res.status(200).json(out);
  } catch (e) {
    console.error("vergelijk-api fout:", e);
    res
      .status(500)
      .json({ fout: e instanceof Error ? e.message : "Onbekende serverfout." });
  }
}
