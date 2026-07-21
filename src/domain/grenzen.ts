import type { Rol } from "./types";

export interface Grenzen {
  minAanvangsleeftijd: number;
  maxAanvangsleeftijd: number;
  maxKoopsom: number;
  afkoopgrensPerJaar: number;
  overgang: { min: number; max: number };
  partnerpensioenToegestaan: number[];
  hoogLaagDuur: { min: number; max: number };
  garantiepercentage: { min: number; max: number };
  historischStartjaar: { min: number; max: number };
}

// Adviseur-grenzen uit de Allianz-productkaart. EO kent extra beperkingen (TODO,
// te bevestigen bij verzekeraar). Per verzekeraar kunnen de grenzen verschillen.
export function grenzenVoor(rol: Rol): Grenzen {
  const basis: Grenzen = {
    minAanvangsleeftijd: 18,
    maxAanvangsleeftijd: 75,
    maxKoopsom: 10_000_000,
    afkoopgrensPerJaar: 613.52,
    overgang: { min: 1, max: 70 },
    partnerpensioenToegestaan: [0, 70, 100],
    hoogLaagDuur: { min: 5, max: 10 },
    garantiepercentage: { min: 0, max: 100 },
    historischStartjaar: { min: 1996, max: 2030 },
  };
  if (rol === "eo") return { ...basis /* TODO: EO-overrides */ };
  return basis;
}
