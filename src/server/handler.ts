import type { Omgeving, VergelijkResultaat, VergelijkVerzoek } from "../domain/types";
import { grenzenVoor } from "../domain/grenzen.js";
import { valideer } from "../domain/valideer.js";
import { dwingEchtBoven } from "../domain/mockPlafond.js";
import { VERZEKERAARS, berekenMock, endpointVoor } from "../adapters/mock.js";
import { credsVoor, roepAllianzAan } from "./allianz.js";
import { laadAsrCert, laadAsrProxy, roepAsrAan } from "./asr.js";

interface Body { verzoek: VergelijkVerzoek; omgeving: Omgeving; verzekeraars: string[]; }

// Server-side orchestratie: Allianz en a.s.r. gaan live, de overige (demo)
// verzekeraars blijven mock zodat de vergelijkstaat gevuld blijft.
//
// De verzekeraars worden PARALLEL afgehandeld (Promise.all), niet sequentieel.
// a.s.r.'s batch-executor mag intern tot 60s duren; sequentieel achter Allianz aan
// zou de totale functietijd al snel over Vercel's timeout heen tillen, waarna de
// hele aanroep faalt en de browser stilletjes terugvalt op de lokale mock (zie
// lib/vergelijk.ts) — met als verwarrend resultaat dat ALLE verzekeraars, inclusief
// Allianz en a.s.r., dan mock-cijfers tonen die er als "echt" uitzien.
export function maakVergelijkHandler(env: Record<string, string | undefined>) {
  return async function handler(body: Body): Promise<{ omgeving: Omgeving; resultaten: VergelijkResultaat[] }> {
    const { verzoek, omgeving, verzekeraars } = body;
    const grenzen = grenzenVoor(verzoek.rol);

    const taken = verzekeraars.map(async (id): Promise<VergelijkResultaat | null> => {
      const cfg = VERZEKERAARS.find((c) => c.id === id);
      if (!cfg || !cfg.producten.includes(verzoek.product)) return null;
      const endpoint = endpointVoor(cfg, verzoek.product, omgeving);

      const errors = valideer(verzoek, grenzen, [cfg.id]).filter((p) => p.niveau === "error");
      if (errors.length) {
        return { verzekeraarId: cfg.id, verzekeraarNaam: cfg.naam, demo: cfg.demo, status: "fout", fouten: errors.map((e) => e.bericht), endpoint };
      }

      if (cfg.id === "allianz") {
        const creds = credsVoor(omgeving, env);
        if (!creds.username || !creds.password) {
          return { verzekeraarId: cfg.id, verzekeraarNaam: cfg.naam, status: "fout", fouten: [`Geen Allianz-credentials voor "${omgeving}". Zet ALLIANZ_${omgeving.toUpperCase()}_USERNAME/PASSWORD in .env.`], endpoint };
        }
        return roepAllianzAan(verzoek, omgeving, creds as { username: string; password: string });
      }
      if (cfg.id === "asr") {
        const cert = laadAsrCert(omgeving, env);
        if (!cert) {
          return { verzekeraarId: cfg.id, verzekeraarNaam: cfg.naam, status: "fout", fouten: [`Geen ASR-clientcertificaat voor "${omgeving}". Zet ASR_PFX_PATH (of ASR_PFX_BASE64) en ASR_PFX_PASSPHRASE in .env.`], endpoint };
        }
        return roepAsrAan(verzoek, omgeving, cert, laadAsrProxy(env));
      }

      const berekening = berekenMock(verzoek, cfg);
      // TIJDELIJK: ruwe request/response voor debugweergave — later weer verwijderen.
      return { verzekeraarId: cfg.id, verzekeraarNaam: cfg.naam, demo: cfg.demo, status: "succes", berekening, endpoint, debug: { request: verzoek, response: berekening } };
    });

    const resultaten = (await Promise.all(taken)).filter((r): r is VergelijkResultaat => r !== null);
    return { omgeving, resultaten: dwingEchtBoven(resultaten) };
  };
}
