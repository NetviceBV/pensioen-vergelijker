import type { VergelijkVerzoek, Berekening, Omgeving, Product } from "../domain/types";
import { leeftijdOp } from "../domain/valideer";
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

export const VERZEKERAARS: VerzekeraarConfig[] = [
  { id: "allianz", naam: "Allianz", producten: ["DIZP", "DIKP", "DIL"], factor: 1.0, rente: 0.67, poliskosten: { maand: 65, kwartaal: 55, halfjaar: 50, jaar: 45 }, admin: 275, distributieEO: 150 },
  { id: "asr", naam: "a.s.r.", demo: true, producten: ["DIZP", "DIKP", "DIL"], factor: 1.02, rente: 0.7, poliskosten: { maand: 62, kwartaal: 53, halfjaar: 48, jaar: 43 }, admin: 260, distributieEO: 125 },
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
  return "— (demo-adapter, API-contract vereist)";
}
