import { readFileSync } from "node:fs";
import { request as httpsRequest } from "node:https";
import type { Berekening, Omgeving, VergelijkResultaat, VergelijkVerzoek } from "../domain/types";
import { leeftijdOp } from "../domain/valideer";
import { endpointVoor, VERZEKERAARS } from "../adapters/mock";

const TERMIJNEN = { maand: 12, kwartaal: 4, halfjaar: 2, jaar: 1 } as const;
const NETTO_FLAT = 0.59; // bruto -> netto (zelfde aanname als elders; ASR levert alleen bruto)
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface AsrCert {
  pfx: Buffer;
  passphrase?: string;
}

// ASR/BMS authenticeert met een client-certificaat (mTLS), niet met wachtwoord.
// Certificaat kan als bestandspad (lokaal/dev) of base64 (bijv. Vercel) worden aangeleverd.
// Env-specifiek (ASR_ACCEPTATIE_*) met terugval op generiek (ASR_*).
export function laadAsrCert(omgeving: Omgeving, env: Record<string, string | undefined>): AsrCert | null {
  const s = omgeving.toUpperCase();
  const b64 = env[`ASR_${s}_PFX_BASE64`] ?? env["ASR_PFX_BASE64"];
  const pad = env[`ASR_${s}_PFX_PATH`] ?? env["ASR_PFX_PATH"];
  const passphrase = env[`ASR_${s}_PFX_PASSPHRASE`] ?? env["ASR_PFX_PASSPHRASE"];

  let pfx: Buffer | null = null;
  if (b64) pfx = Buffer.from(b64, "base64");
  else if (pad) {
    try {
      pfx = readFileSync(pad);
    } catch {
      return null;
    }
  }
  if (!pfx) return null;
  return { pfx, passphrase };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const geslachtNaarAsr = (g: string) => (g === "man" ? "M" : "V");

// Bouwt het BatchInput-XML voor een vaste uitkering (Variabel=false, levenslang OP).
//
// Aannames — te bevestigen bij a.s.r.:
//  - BerekeningSoort=OP, LevenslangTijdelijkVerhouding=1 (levenslang), Fiscaliteit=B (bruto).
//  - GegevensPartner is verplicht in het schema. Zonder partner sturen we het knooppunt
//    tóch mee met FactorPartnerPensioen=0 en Bestemming=OP, zodat er geen partnerpensioen
//    wordt gefinancierd. Mét partner: Bestemming=B (beide) en factor = overgang/100.
export function buildAsrXml(v: VergelijkVerzoek): string {
  const id = `ASRDIP${Date.now()}`;
  const heeftPartner = Boolean(v.partner);
  const bestemming = heeftPartner ? "B" : "OP";
  const factor = heeftPartner ? (v.partner!.overgangspercentage ?? 70) / 100 : 0;
  const partnerGeb = heeftPartner ? v.partner!.geboortedatum : v.deelnemer.geboortedatum;
  const partnerGesl = heeftPartner ? geslachtNaarAsr(v.partner!.geslacht) : v.deelnemer.geslacht === "man" ? "V" : "M";

  return `<?xml version="1.0" encoding="UTF-8"?>
<BatchInput BatchSize="1">
  <DIPInvoer ID="${esc(id)}" Geboortedatum="${esc(v.deelnemer.geboortedatum)}" Geslacht="${geslachtNaarAsr(v.deelnemer.geslacht)}" PensioenDatum="${esc(v.ingangsdatum)}" BerekeningSoort="OP" Variabel="false" LevenslangTijdelijkVerhouding="1">
    <DIPKapitaal Bedrag="${Math.round(v.kapitaal)}" Fiscaliteit="B" Bestemming="${bestemming}"/>
    <GegevensPartner Geboortedatum="${esc(partnerGeb)}" Geslacht="${partnerGesl}" FactorPartnerPensioen="${factor}"/>
  </DIPInvoer>
</BatchInput>`;
}

function xmlTag(xml: string, naam: string): string | undefined {
  const m = new RegExp(`<${naam}>([\\s\\S]*?)</${naam}>`).exec(xml);
  return m ? m[1].trim() : undefined;
}

// Normaliseert het ASR-antwoord naar de gedeelde Berekening-vorm.
// Belangrijk: de ASR-API kent geen uitkeringstermijn; het bedrag is een MAANDbedrag
// (aanname — te bevestigen). We rekenen om naar de door de gebruiker gekozen termijn.
function normaliseer(v: VergelijkVerzoek, xml: string): { berekening: Berekening } | { fout: string } {
  const status = xmlTag(xml, "Status");
  if (!status) return { fout: "Geen <Status> in het ASR-antwoord." };
  if (status.toLowerCase() !== "success") return { fout: `ASR meldde status "${status}".` };

  const verwacht = Number(xmlTag(xml, "BrutoVerwachtWeer"));
  if (!Number.isFinite(verwacht)) return { fout: "Geen bruikbaar uitkeringsbedrag in het ASR-antwoord." };

  const maandBruto = verwacht;
  const perTermijnFactor = 12 / TERMIJNEN[v.uitkeringstermijn]; // maand→1, kwartaal→3, halfjaar→6, jaar→12
  const brutoTermijn = maandBruto * perTermijnFactor;
  const jaarBruto = maandBruto * 12;
  const leeftijd = leeftijdOp(v.deelnemer.geboortedatum, v.ingangsdatum) || 0;

  return {
    berekening: {
      eersteTermijn: { bruto: round2(brutoTermijn), netto: round2(brutoTermijn * NETTO_FLAT) },
      perJaar: { bruto: round2(jaarBruto), netto: round2(jaarBruto * NETTO_FLAT) },
      leeftijd,
      // ASR levert geen garantierente of kostenspecificatie → optioneel weglaten ("—" in de UI).
    },
  };
}

function postXmlMetCert(endpoint: string, xml: string, cert: AsrCert): Promise<{ status: number; body: string }> {
  const u = new URL(endpoint);
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: "POST",
        pfx: cert.pfx,
        passphrase: cert.passphrase,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          Accept: "application/xml",
          "Content-Length": Buffer.byteLength(xml, "utf8"),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    // De 'execute'-methode wacht max 60s op de batch; iets ruimer afkappen.
    req.setTimeout(65_000, () => req.destroy(new Error("Time-out: ASR-batch niet binnen 65 seconden afgerond.")));
    req.on("error", reject);
    req.write(xml, "utf8");
    req.end();
  });
}

export async function roepAsrAan(v: VergelijkVerzoek, omgeving: Omgeving, cert: AsrCert): Promise<VergelijkResultaat> {
  const cfg = VERZEKERAARS.find((c) => c.id === "asr")!;
  const endpoint = endpointVoor(cfg, v.product, omgeving);
  const base = { verzekeraarId: "asr", verzekeraarNaam: cfg.naam, endpoint };

  const xml = buildAsrXml(v);
  // TIJDELIJK: ruwe request/response voor debugweergave — later weer verwijderen.
  const ruweRequest = { contentType: "application/xml", body: xml };

  let antwoord: { status: number; body: string };
  try {
    antwoord = await postXmlMetCert(endpoint, xml, cert);
  } catch (e) {
    return {
      ...base,
      status: "fout",
      fouten: [e instanceof Error ? e.message : "Onbekende fout bij de ASR-aanroep."],
      debug: { request: ruweRequest, response: null },
    };
  }

  const ruweResponse = { httpStatus: antwoord.status, body: antwoord.body };

  // 500 → plain-text foutmelding; 400 → XML met validatiestatus; 200 → XML met resultaat.
  if (antwoord.status === 500) {
    return { ...base, status: "fout", fouten: [`HTTP 500 van ASR: ${antwoord.body.slice(0, 500) || "onbekende serverfout."}`], debug: { request: ruweRequest, response: ruweResponse } };
  }
  if (antwoord.status === 401) {
    return { ...base, status: "fout", fouten: ["HTTP 401 van ASR: client-certificaat ontbreekt, is verlopen of wordt niet herkend."], debug: { request: ruweRequest, response: ruweResponse } };
  }

  const genormaliseerd = normaliseer(v, antwoord.body);
  if ("fout" in genormaliseerd) {
    const prefix = antwoord.status !== 200 ? `HTTP ${antwoord.status}. ` : "";
    return { ...base, status: "fout", fouten: [`${prefix}${genormaliseerd.fout}`], debug: { request: ruweRequest, response: ruweResponse } };
  }

  return { ...base, status: "succes", berekening: genormaliseerd.berekening, debug: { request: ruweRequest, response: ruweResponse } };
}
