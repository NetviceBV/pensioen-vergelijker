import type { Berekening, Omgeving, VergelijkResultaat, VergelijkVerzoek } from "../domain/types";
import { VERZEKERAARS, endpointVoor } from "../adapters/mock";

const TERMIJNEN = { maand: 12, kwartaal: 4, halfjaar: 2, jaar: 1 } as const;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function credsVoor(omgeving: Omgeving, env: Record<string, string | undefined>) {
  const s = omgeving.toUpperCase();
  return { username: env[`ALLIANZ_${s}_USERNAME`], password: env[`ALLIANZ_${s}_PASSWORD`] };
}

// ISO yyyy-mm-dd -> Allianz d-m-j zonder leading zeros ("1-7-2018").
function toAllianzDatum(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Ongeldige datum: ${iso}`);
  return `${Number(m[3])}-${Number(m[2])}-${Number(m[1])}`;
}

function buildPayload(v: VergelijkVerzoek): Record<string, string> {
  const p: Record<string, string> = {};
  const put = (k: string, val: string | number | undefined | null) => {
    if (val !== undefined && val !== null && val !== "") p[k] = String(val);
  };
  put("geslacht_deelnemer", v.deelnemer.geslacht);
  put("geboortedatum_deelnemer", toAllianzDatum(v.deelnemer.geboortedatum));
  put("kapitaal", Math.round(v.kapitaal));
  put("uitkeringstermijn", v.uitkeringstermijn);
  put("ingangsdatum", toAllianzDatum(v.ingangsdatum));

  if (v.product === "DIZP" || v.product === "DIKP") {
    // Niet in de handleiding v1.4, maar sinds kort verplicht op /api/berekenuitkering
    // (bevestigd tegen acceptatie): zonder dit veld geeft Allianz een HTTP 422
    // "Veld netto is verplicht". Alleen "0"/"1" worden geaccepteerd; de output
    // bleek in beide gevallen identiek, dus we sturen altijd 1 mee.
    put("netto", 1);
  }

  if (v.product === "DIZP") {
    put("garantiepercentage", 100);
    put("hoog_laag_duur", v.hoogLaagDuur);
  } else if (v.product === "DIKP") {
    const garantie = v.garantiepercentage ?? 0;
    put("garantiepercentage", garantie);
    if (garantie < 100) {
      // Bevestigde bug in Allianz' acceptatieomgeving: scenario + uitkeringsverloop
      // samen bij garantiepercentage<100 geeft een HTTP 500 (Berekening.php:646,
      // "$scenario - 1" op een niet-numerieke waarde). Workaround: scenario niet
      // meesturen — Allianz retourneert dan sowieso alle scenariovarianten
      // (handleiding §7, regel 3b), en kiesProduct() filtert 'm client-side.
      // "historisch" heeft geen workaround (crasht altijd) en wordt al eerder
      // geblokkeerd door valideer.ts.
      put("uitkeringsverloop", v.uitkeringsverloop);
    } else {
      put("scenario", v.scenario);
      if (v.scenario === "historisch") put("historisch_startjaar", v.historischStartjaar);
    }
  }
  if (v.partner) {
    put("geslacht_partner", v.partner.geslacht);
    put("geboortedatum_partner", toAllianzDatum(v.partner.geboortedatum));
    if (v.product === "DIL") put("partnerpensioen_percentage", v.partner.partnerpensioenPercentage);
  }
  if (v.product === "DIL" && v.einddatum) put("einddatum", toAllianzDatum(v.einddatum));
  return p;
}

function kiesProduct(v: VergelijkVerzoek, producten: any[]): any | undefined {
  if (v.product === "DIZP" || v.product === "DIL") {
    return producten.find((p) => Number(p.garantiepercentage) === 100) ?? producten[0];
  }
  // DIKP
  let cands = producten;
  if (v.scenario) cands = cands.filter((p) => p.scenario === v.scenario);
  return cands[0] ?? producten[0];
}

function normaliseer(v: VergelijkVerzoek, output: any): Berekening | null {
  const cfg = VERZEKERAARS.find((c) => c.id === "allianz")!;
  const producten: any[] = Array.isArray(output?.producten) ? output.producten : [];
  const prod = kiesProduct(v, producten);
  const b0 = prod?.uitkering_bruto?.[0];
  const n0 = prod?.uitkering_netto?.[0];
  if (!b0) return null;

  const bruto = (b0.dip ?? 0) + (b0.db ?? 0);
  const netto = (n0?.dip ?? 0) + (n0?.db ?? 0);
  const termijnen = TERMIJNEN[v.uitkeringstermijn];

  let band: Berekening["band"];
  if (v.product === "DIKP") {
    const nettoVan = (p: any) => {
      const n = p?.uitkering_netto?.[0];
      return n ? (n.dip ?? 0) + (n.db ?? 0) : undefined;
    };
    const pw = nettoVan(producten.find((p) => p.scenario === "pessimistisch"));
    const ow = nettoVan(producten.find((p) => p.scenario === "optimistisch"));
    if (pw != null && ow != null) band = { pessimistisch: round2(pw), optimistisch: round2(ow) };
  }

  return {
    eersteTermijn: { bruto: round2(bruto), netto: round2(netto) },
    perJaar: { bruto: round2(bruto * termijnen), netto: round2(netto * termijnen) },
    garantierente: output.garantierente ?? 0,
    poliskostenPerTermijn: cfg.poliskosten[v.uitkeringstermijn],
    eenmaligeKosten: cfg.admin + cfg.distributieEO,
    band,
    leeftijd: b0.leeftijd ?? 0,
  };
}

export async function roepAllianzAan(
  v: VergelijkVerzoek,
  omgeving: Omgeving,
  creds: { username: string; password: string },
): Promise<VergelijkResultaat> {
  const cfg = VERZEKERAARS.find((c) => c.id === "allianz")!;
  const endpoint = endpointVoor(cfg, v.product, omgeving);
  const base = { verzekeraarId: "allianz", verzekeraarNaam: "Allianz", endpoint };

  // TIJDELIJK: ruwe request/response voor debugweergave — later weer verwijderen.
  const payload = buildPayload(v);
  const ruweRequest = { ...payload, username: creds.username, password: "••••••••" };

  let json: any;
  try {
    const form = new FormData();
    form.append("username", creds.username);
    form.append("password", creds.password);
    for (const [k, val] of Object.entries(payload)) form.append(k, val);

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 20_000);
    try {
      const resp = await fetch(endpoint, { method: "POST", body: form, headers: { Accept: "application/json" }, signal: ac.signal });
      if (!resp.ok) {
        const tekst = await resp.text().catch(() => "");
        let detail: string | undefined;
        let ruweResponse: unknown = tekst;
        try {
          const body = JSON.parse(tekst);
          ruweResponse = body;
          const fouten = body?.fouten ?? body?.errors ?? body?.message;
          if (Array.isArray(fouten)) detail = fouten.map((f) => (typeof f === "string" ? f : JSON.stringify(f))).join(" ");
          else if (typeof fouten === "string") detail = fouten;
          else if (fouten != null) detail = JSON.stringify(fouten);
          else detail = tekst.slice(0, 500) || undefined;
        } catch {
          detail = tekst ? tekst.slice(0, 500) : undefined;
        }
        return {
          ...base,
          status: "fout",
          fouten: [`HTTP ${resp.status} van Allianz (${endpoint}).${detail ? ` ${detail}` : ""}`],
          debug: { request: ruweRequest, response: { httpStatus: resp.status, body: ruweResponse } },
        };
      }
      json = await resp.json();
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    return {
      ...base,
      status: "fout",
      fouten: [e instanceof Error ? e.message : "Onbekende fout bij de Allianz-aanroep."],
      debug: { request: ruweRequest, response: null },
    };
  }

  if (json?.status !== "Succes") {
    const fouten = Array.isArray(json?.fouten) ? json.fouten : [String(json?.status ?? "Onbekende status van Allianz.")];
    return { ...base, status: "fout", fouten, debug: { request: ruweRequest, response: json } };
  }

  const berekening = normaliseer(v, json.output ?? {});
  if (!berekening) return { ...base, status: "fout", fouten: ["Geen bruikbaar product in het Allianz-antwoord."], debug: { request: ruweRequest, response: json } };
  return { ...base, status: "succes", berekening, debug: { request: ruweRequest, response: json } };
}
