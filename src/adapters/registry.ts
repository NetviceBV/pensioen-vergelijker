import type { Product } from "../domain/types";
import { VERZEKERAARS } from "./mock";
import type { VerzekeraarConfig } from "./types";

export function alleVerzekeraars(): VerzekeraarConfig[] { return VERZEKERAARS; }
export function verzekeraarsVoor(product: Product): VerzekeraarConfig[] {
  return VERZEKERAARS.filter((v) => v.producten.includes(product));
}
export function getVerzekeraar(id: string): VerzekeraarConfig | undefined {
  return VERZEKERAARS.find((v) => v.id === id);
}
