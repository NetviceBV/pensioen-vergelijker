import type { VergelijkVerzoek } from "./types";
import type { Grenzen } from "./grenzen";

export type Niveau = "error" | "warning";
export interface Probleem { veld: string; niveau: Niveau; bericht: string; }

export function leeftijdOp(geboorte: string, peil: string): number {
  const g = new Date(geboorte), p = new Date(peil);
  if (Number.isNaN(g.getTime()) || Number.isNaN(p.getTime())) return NaN;
  let a = p.getFullYear() - g.getFullYear();
  const m = p.getMonth() - g.getMonth();
  if (m < 0 || (m === 0 && p.getDate() < g.getDate())) a--;
  return a;
}

// verzekeraarIds: de (op dit moment relevante) verzekeraar(s) waarvoor gevalideerd
// wordt — bepaalt of verzekeraar-specifieke eisen (bijv. Allianz' webservice-bugs
// rond uitkeringsverloop/historisch/hoogLaagDuur) daadwerkelijk gelden. Server-side
// wordt dit per verzekeraar aangeroepen (dus met [cfg.id]); client-side met alle
// geselecteerde verzekeraars, zodat het formulier alleen eist wat voor de huidige
// selectie relevant is.
export function valideer(v: VergelijkVerzoek, g: Grenzen, verzekeraarIds: string[]): Probleem[] {
  const p: Probleem[] = [];
  const err = (veld: string, bericht: string) => p.push({ veld, niveau: "error", bericht });
  const warn = (veld: string, bericht: string) => p.push({ veld, niveau: "warning", bericht });
  const heeftAllianz = verzekeraarIds.includes("allianz");

  const lft = leeftijdOp(v.deelnemer.geboortedatum, v.ingangsdatum);
  if (Number.isNaN(lft)) err("geboortedatum", "Geboortedatum of ingangsdatum is ongeldig.");
  else if (lft < g.minAanvangsleeftijd) err("geboortedatum", `Aanvangsleeftijd ${lft} is lager dan het minimum van ${g.minAanvangsleeftijd}.`);
  else if (lft > g.maxAanvangsleeftijd) err("geboortedatum", `Aanvangsleeftijd ${lft} is hoger dan het maximum van ${g.maxAanvangsleeftijd}.`);

  if (!(v.kapitaal > 0)) err("kapitaal", "Kapitaal moet groter dan 0 zijn.");
  else if (v.kapitaal > g.maxKoopsom) err("kapitaal", `Kapitaal overschrijdt de maximale koopsom van € ${g.maxKoopsom.toLocaleString("nl-NL")}.`);

  if (v.partner) {
    const lp = leeftijdOp(v.partner.geboortedatum, v.ingangsdatum);
    if (Number.isNaN(lp) || lp < g.minAanvangsleeftijd || lp > g.maxAanvangsleeftijd)
      err("partner", `Leeftijd partner valt buiten ${g.minAanvangsleeftijd}–${g.maxAanvangsleeftijd}.`);
    if (v.product === "DIL") {
      const pp = v.partner.partnerpensioenPercentage;
      if (pp == null) err("partnerpensioen", "Partnerpensioen-percentage is verplicht bij een partner (DIL).");
      else if (!g.partnerpensioenToegestaan.includes(pp)) err("partnerpensioen", `Toegestaan: ${g.partnerpensioenToegestaan.join(", ")}.`);
    } else {
      const o = v.partner.overgangspercentage;
      if (o == null || o < g.overgang.min || o > g.overgang.max)
        err("overgang", `Overgang op partner moet tussen ${g.overgang.min}% en ${g.overgang.max}% liggen.`);
    }
  }

  if (v.product === "DIKP") {
    if (v.garantiepercentage == null) {
      err("garantiepercentage", "Garantiepercentage is verplicht bij DIKP.");
    } else if (heeftAllianz && v.garantiepercentage < 100) {
      if (v.uitkeringsverloop == null)
        err("uitkeringsverloop", "Uitkeringsverloop is verplicht zodra garantiepercentage lager is dan 100% (Allianz-webservice-eis).");
      if (v.scenario === "historisch")
        err("scenario", "Historisch scenario in combinatie met garantiepercentage < 100% wordt niet ondersteund door de Allianz-webservice (bevestigde serverfout in de acceptatieomgeving).");
    }
    if (heeftAllianz && v.scenario === "historisch" && v.historischStartjaar == null)
      err("historischStartjaar", "Historisch startjaar is verplicht bij het historische scenario.");
  }

  if (heeftAllianz && v.product === "DIZP" && v.hoogLaagDuur != null) {
    const { min, max } = g.hoogLaagDuur;
    if (v.hoogLaagDuur < min || v.hoogLaagDuur > max)
      err("hoogLaagDuur", `Hoog/laag-duur moet tussen ${min} en ${max} jaar liggen (Allianz-webservice-grens).`);
  }

  if (v.product === "DIL" && v.einddatum && new Date(v.einddatum) <= new Date(v.ingangsdatum))
    err("einddatum", "Einddatum moet na de ingangsdatum liggen.");

  return p;
}
