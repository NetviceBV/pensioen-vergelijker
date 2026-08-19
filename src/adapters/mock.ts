import type { VergelijkVerzoek, Berekening, Omgeving, Product } from "../domain/types";
import { leeftijdOp } from "../domain/valideer.js";
import type { VerzekeraarConfig } from "./types";

const TERMIJNEN = { maand: 12, kwartaal: 4, halfjaar: 2, jaar: 1 } as const;
const NETTO_FLAT = 0.59; // bruto -> netto (handleiding)

// Endpointtabel per omgeving (Allianz); voor demo-partijen niet van toepassing.
const ALLIANZ_URLS: Record<Product, Record<Omgeving, string>> = {
  DIZP: {
    test: "https://test-directingaandpensioen.epg-info.nl/api/berekenuitkering",
    acceptatie: "https://acc-directingaandpensioen.epg-info.nl/api/berekenuitkering",
    productie: "https://leven.allianz.nl/api/berekenuitkering",
  },
  DIKP: {
    test: "https://test-directingaandpensioen.epg-info.nl/api/berekenuitkering",
    acceptatie: "https://acc-directingaandpensioen.epg-info.nl/api/berekenuitkering",
    productie: "https://leven.allianz.nl/api/berekenuitkering",
  },
  DIL: {
    test: "https://test-directingaandpensioen.epg-info.nl/api/berekenDILuitkering",
    acceptatie: "https://acc-directingaandpensioen.epg-info.nl/api/berekenDILuitkering",
    productie: "https://leven.allianz.nl/api/berekenDILuitkering",
  },
};

// ASR/BMS (eBenefits) — XML-stream "ASR DIP". Geen apart test-endpoint; test valt
// terug op staging (acceptatie). Zie de BMS API-documentatie.
const ASR_URLS: Record<Omgeving, string> = {
  test: "https://acceptatiebms.mijnpensioenportaal.nl/public/api/processor/execute-v1/ASR%20DIP",
  acceptatie: "https://acceptatiebms.mijnpensioenportaal.nl/public/api/processor/execute-v1/ASR%20DIP",
  productie: "https://bms.mijnpensioenportaal.nl/public/api/processor/execute-v1/ASR%20DIP",
};

export const VERZEKERAARS: VerzekeraarConfig[] = [
  {
    id: "allianz", naam: "Allianz", producten: ["DIZP", "DIKP", "DIL"],
    // Allianz gebruikt alle optionele velden: hoogLaagDuur (DIZP), scenario +
    // historischStartjaar + uitkeringsverloop (DIKP, zie allianz.ts voor de
    // webservice-eisen/bugs die hierachter zitten).
    extraVelden: { DIZP: ["hoogLaagDuur"], DIKP: ["scenario", "historischStartjaar", "uitkeringsverloop"] },
    factor: 1.0, rente: 0.67, poliskosten: { maand: 65, kwartaal: 55, halfjaar: 50, jaar: 45 }, admin: 275, distributieEO: 150,
  },
  // a.s.r. draait live via de ASR-adapter (server/asr.ts): DIZP (vast, Variabel=false)
  // en DIKP (doorbeleggen, Variabel=true). DIL wordt niet ondersteund door de ASR
  // DIP-stream — a.s.r. verschijnt dan automatisch als "niet beschikbaar" (zelfde
  // generieke mechanisme als bij Zwitserleven, dat ook geen DIL heeft).
  // Bij DIKP gebruikt a.s.r. alleen uitkeringsverloop (→ Daling); geen scenario- of
  // historisch-concept, en de garantiepercentage-waarde wordt genegeerd (zie asr.ts).
  // De factor/rente/poliskosten-velden zijn voor de echte adapter niet van toepassing
  // en blijven ongebruikt; ze staan er enkel om aan het configtype te voldoen.
  {
    id: "asr", naam: "a.s.r.", producten: ["DIZP", "DIKP"],
    extraVelden: { DIKP: ["uitkeringsverloop"] },
    factor: 1.0, rente: 0, poliskosten: { maand: 0, kwartaal: 0, halfjaar: 0, jaar: 0 }, admin: 0, distributieEO: 0,
  },
  { id: "nn", naam: "Nationale-Nederlanden", demo: true, producten: ["DIZP", "DIL"], factor: 0.995, rente: 0.64, poliskosten: { maand: 68, kwartaal: 57, halfjaar: 52, jaar: 47 }, admin: 290, distributieEO: 160 },
  { id: "zwitserleven", naam: "Zwitserleven", demo: true, producten: ["DIZP", "DIKP"], factor: 1.028, rente: 0.72, poliskosten: { maand: 60, kwartaal: 51, halfjaar: 46, jaar: 41 }, admin: 250, distributieEO: 140 },
];

function jarenTussen(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

// Indicatieve berekening — bootst de vorm van het verzekeraar-antwoord na.
export function berekenMock(v: VergelijkVerzoek, cfg: VerzekeraarConfig): Berekening {
  const leeftijd = leeftijdOp(v.deelnemer.geboortedatum, v.ingangsdatum) || 67;
  const termijnen = TERMIJNEN[v.uitkeringstermijn];
  const baseRate = Math.max(0.02, 0.046 + (leeftijd - 65) * 0.0013);

  let jaarBruto: number;
  if (v.product === "DIL" && v.einddatum) {
    const dur = Math.max(1, jarenTussen(v.ingangsdatum, v.einddatum));
    jaarBruto = (v.kapitaal / dur) * 1.02 * cfg.factor;
  } else {
    jaarBruto = v.kapitaal * baseRate * cfg.factor;
  }

  const brutoTermijn = jaarBruto / termijnen;
  const nettoTermijn = brutoTermijn * NETTO_FLAT;

  let band: Berekening["band"];
  if (v.product === "DIKP") {
    const spread = (100 - (v.garantiepercentage ?? 0)) / 100;
    band = { pessimistisch: nettoTermijn * (1 - 0.35 * spread), optimistisch: nettoTermijn * (1 + 0.45 * spread) };
  }

  return {
    eersteTermijn: { bruto: brutoTermijn, netto: nettoTermijn },
    perJaar: { bruto: jaarBruto, netto: jaarBruto * NETTO_FLAT },
    garantierente: cfg.rente,
    poliskostenPerTermijn: cfg.poliskosten[v.uitkeringstermijn],
    eenmaligeKosten: cfg.admin + cfg.distributieEO,
    band,
    leeftijd,
  };
}

export function endpointVoor(cfg: VerzekeraarConfig, product: Product, env: Omgeving): string {
  if (cfg.id === "allianz") return ALLIANZ_URLS[product][env];
  if (cfg.id === "asr") return ASR_URLS[env];
  return "— (demo-adapter, API-contract vereist)";
}
