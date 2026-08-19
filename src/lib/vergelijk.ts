import type { Omgeving, VergelijkResultaat, VergelijkVerzoek } from "../domain/types";
import { grenzenVoor } from "../domain/grenzen";
import { valideer } from "../domain/valideer";
import { dwingEchtBoven } from "../domain/mockPlafond";
import { getVerzekeraar } from "../adapters/registry";
import { berekenMock, endpointVoor } from "../adapters/mock";

// Roept de server-proxy aan (/api/vergelijk). Die doet Allianz live met de
// credentials uit .env en houdt de demo-verzekeraars op mock. Als de proxy niet
// bereikbaar is (bijv. een statische build zonder dev-server), valt de app terug
// op een lokale mockberekening zodat de UI blijft werken.
export async function vergelijk(
  verzoek: VergelijkVerzoek,
  omgeving: Omgeving,
  verzekeraarIds: string[],
): Promise<VergelijkResultaat[]> {
  try {
    const res = await fetch("/api/vergelijk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ verzoek, omgeving, verzekeraars: verzekeraarIds }),
    });
    if (!res.ok) throw new Error(`Vergelijk-API gaf status ${res.status}`);
    const data = (await res.json()) as { resultaten?: VergelijkResultaat[] };
    if (!data.resultaten) throw new Error("Onverwacht antwoord van de vergelijk-API");
    return data.resultaten;
  } catch (e) {
    console.warn("Vergelijk-API niet bereikbaar — terugval op lokale mock.", e);
    return vergelijkLokaalMock(verzoek, omgeving, verzekeraarIds);
  }
}

function vergelijkLokaalMock(verzoek: VergelijkVerzoek, omgeving: Omgeving, verzekeraarIds: string[]): VergelijkResultaat[] {
  const grenzen = grenzenVoor(verzoek.rol);
  const resultaten = verzekeraarIds
    .map(getVerzekeraar)
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .filter((c) => c.producten.includes(verzoek.product))
    .map((cfg) => {
      const endpoint = endpointVoor(cfg, verzoek.product, omgeving);
      const errors = valideer(verzoek, grenzen, [cfg.id]).filter((p) => p.niveau === "error");
      if (errors.length) return { verzekeraarId: cfg.id, verzekeraarNaam: cfg.naam, demo: cfg.demo, status: "fout" as const, fouten: errors.map((e) => e.bericht), endpoint };
      const berekening = berekenMock(verzoek, cfg);
      // TIJDELIJK: ruwe request/response voor debugweergave — later weer verwijderen.
      return { verzekeraarId: cfg.id, verzekeraarNaam: cfg.naam, demo: cfg.demo, status: "succes" as const, berekening, endpoint, debug: { request: verzoek, response: berekening } };
    });
  return dwingEchtBoven(resultaten);
}
