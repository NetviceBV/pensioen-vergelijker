import type { Product, VeldKey } from "../domain/types";
import { VERZEKERAARS } from "./mock";
import type { VerzekeraarConfig } from "./types";

export function alleVerzekeraars(): VerzekeraarConfig[] { return VERZEKERAARS; }
export function verzekeraarsVoor(product: Product): VerzekeraarConfig[] {
  return VERZEKERAARS.filter((v) => v.producten.includes(product));
}
export function getVerzekeraar(id: string): VerzekeraarConfig | undefined {
  return VERZEKERAARS.find((v) => v.id === id);
}

// Unie van alle VeldKey-velden die de gegeven verzekeraars gebruiken voor dit
// product. Stuurt welke optionele invoervelden zichtbaar/verplicht zijn: een veld
// verschijnt zodra minstens één geselecteerde verzekeraar het gebruikt.
export function relevanteVelden(product: Product, verzekeraarIds: string[]): Set<VeldKey> {
  const set = new Set<VeldKey>();
  for (const id of verzekeraarIds) {
    const velden = getVerzekeraar(id)?.extraVelden?.[product];
    velden?.forEach((v) => set.add(v));
  }
  return set;
}
