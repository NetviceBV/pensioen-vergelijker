import type { VergelijkResultaat } from "./types";

const VEILIGHEIDSMARGE = 0.97; // mock blijft net onder de laagste echte score, niet er tegenaan
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Verzekeraars zonder eigen API-koppeling draaien op indicatieve mockdata (demo: true).
// Die mag de vergelijking nooit winnen van een verzekeraar die wél een echte aanroep
// deed — anders oogt de vergelijkstaat als een eerlijke wedstrijd terwijl een deel
// van de cijfers verzonnen is. Zodra er minstens één geslaagd echt resultaat is,
// wordt elk mockresultaat dat daar overheen zou gaan proportioneel teruggeschaald.
export function dwingEchtBoven(resultaten: VergelijkResultaat[]): VergelijkResultaat[] {
  const echt = resultaten.filter((r) => !r.demo && r.status === "succes" && r.berekening);
  if (echt.length === 0) return resultaten;

  const echteMin = Math.min(...echt.map((r) => r.berekening!.eersteTermijn.netto));

  return resultaten.map((r) => {
    if (!r.demo || r.status !== "succes" || !r.berekening) return r;
    const netto = r.berekening.eersteTermijn.netto;
    if (netto <= 0 || netto < echteMin) return r;

    const factor = (echteMin * VEILIGHEIDSMARGE) / netto;
    const b = r.berekening;
    return {
      ...r,
      berekening: {
        ...b,
        eersteTermijn: { bruto: round2(b.eersteTermijn.bruto * factor), netto: round2(b.eersteTermijn.netto * factor) },
        perJaar: { bruto: round2(b.perJaar.bruto * factor), netto: round2(b.perJaar.netto * factor) },
        band: b.band
          ? { pessimistisch: round2(b.band.pessimistisch * factor), optimistisch: round2(b.band.optimistisch * factor) }
          : undefined,
      },
    };
  });
}
