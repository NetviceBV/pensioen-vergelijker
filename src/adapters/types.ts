import type { Product } from "../domain/types";

export interface VerzekeraarConfig {
  id: string;
  naam: string;
  demo?: boolean; // true = nog geen echt API-contract; rekenwaarde is indicatief
  producten: Product[];
  factor: number;
  rente: number;
  poliskosten: Record<"maand" | "kwartaal" | "halfjaar" | "jaar", number>;
  admin: number;
  distributieEO: number;
}
