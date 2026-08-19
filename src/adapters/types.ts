import type { Product, VeldKey } from "../domain/types";

export interface VerzekeraarConfig {
  id: string;
  naam: string;
  demo?: boolean; // true = nog geen echt API-contract; rekenwaarde is indicatief
  producten: Product[];
  // Welke optionele/productspecifieke velden (VeldKey) deze verzekeraar gebruikt,
  // per product. Ontbreekt een product hier (of staat het er niet in), dan gebruikt
  // die verzekeraar voor dat product geen van de VeldKey-velden. Stuurt de
  // veld-zichtbaarheid en validatie in InvoerPaneel/valideer.ts.
  extraVelden?: Partial<Record<Product, VeldKey[]>>;
  factor: number;
  rente: number;
  poliskosten: Record<"maand" | "kwartaal" | "halfjaar" | "jaar", number>;
  admin: number;
  distributieEO: number;
}
