import type { Omgeving, VergelijkResultaat, VergelijkVerzoek } from "../domain/types";
import { grenzenVoor } from "../domain/grenzen";
import { valideer } from "../domain/valideer";
import { dwingEchtBoven } from "../domain/mockPlafond";
import { VERZEKERAARS, berekenMock, endpointVoor } from "../adapters/mock";
import { credsVoor, roepAllianzAan } from "./allianz";
import { laadAsrCert, laadAsrProxy, roepAsrAan } from "./asr";

interface Body { verzoek: VergelijkVerzoek; omgeving: Omgeving; verzekeraars: string[]; }

// Server-side orchestratie: Allianz gaat live, de overige (demo) verzekeraars
// blijven mock zodat de vergelijkstaat gevuld blijft.
export function maakVergelijkHandler(env: Record<string, string | undefined>) {
  return async function handler(body: Body): Promise<{ omgeving: Omgeving; resultaten: VergelijkResultaat[] }> {
    const { verzoek, omgeving, verzekeraars } = body;
    const grenzen = grenzenVoor(verzoek.rol);
    const resultaten: VergelijkResultaat[] = [];

    for (const id of verzekeraars) {
      const cfg = VERZEKERAARS.find((c) => c.id === id);
      if (!cfg || !cfg.producten.includes(verzoek.product)) continue;
      const endpoint = endpointVoor(cfg, verzoek.product, omgeving);

      const errors = valideer(verzoek, grenzen).filter((p) => p.niveau === "error");
      if (errors.length) {
        resultaten.push({ verzekeraarId: cfg.id, verzekeraarNaam: cfg.naam, demo: cfg.demo, status: "fout", fouten: errors.map((e) => e.bericht), endpoint });
        continue;
      }

      if (cfg.id === "allianz") {
        const creds = credsVoor(omgeving, env);
        if (!creds.username || !creds.password) {
          resultaten.push({ verzekeraarId: cfg.id, verzekeraarNaam: cfg.naam, status: "fout", fouten: [`Geen Allianz-credentials voor "${omgeving}". Zet ALLIANZ_${omgeving.toUpperCase()}_USERNAME/PASSWORD in .env.`], endpoint });
          continue;
        }
        resultaten.push(await roepAllianzAan(verzoek, omgeving, creds as { username: string; password: string }));
      } else if (cfg.id === "asr") {
        const cert = laadAsrCert(omgeving, env);
        if (!cert) {
          resultaten.push({ verzekeraarId: cfg.id, verzekeraarNaam: cfg.naam, status: "fout", fouten: [`Geen ASR-clientcertificaat voor "${omgeving}". Zet ASR_PFX_PATH (of ASR_PFX_BASE64) en ASR_PFX_PASSPHRASE in .env.`], endpoint });
          continue;
        }
        resultaten.push(await roepAsrAan(verzoek, omgeving, cert, laadAsrProxy(env)));
      } else {
        const berekening = berekenMock(verzoek, cfg);
        // TIJDELIJK: ruwe request/response voor debugweergave — later weer verwijderen.
        resultaten.push({ verzekeraarId: cfg.id, verzekeraarNaam: cfg.naam, demo: cfg.demo, status: "succes", berekening, endpoint, debug: { request: verzoek, response: berekening } });
      }
    }
    return { omgeving, resultaten: dwingEchtBoven(resultaten) };
  };
}
