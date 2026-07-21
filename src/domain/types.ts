export type Omgeving = "test" | "acceptatie" | "productie";
export type Product = "DIZP" | "DIKP" | "DIL";
export type Rol = "adviseur" | "eo";
export type Geslacht = "man" | "vrouw";
export type Uitkeringstermijn = "maand" | "kwartaal" | "halfjaar" | "jaar";
export type Scenario = "verwacht" | "pessimistisch" | "optimistisch" | "historisch";
export type Uitkeringsverloop = "dalend" | "gelijkblijvend";

export interface Persoon { geslacht: Geslacht; geboortedatum: string; }
export interface Partner extends Persoon { overgangspercentage?: number; partnerpensioenPercentage?: number; }

export interface VergelijkVerzoek {
  product: Product;
  rol: Rol;
  deelnemer: Persoon;
  partner?: Partner;
  kapitaal: number;
  uitkeringstermijn: Uitkeringstermijn;
  ingangsdatum: string;
  garantiepercentage?: number;
  hoogLaagDuur?: number;
  uitkeringsverloop?: Uitkeringsverloop;
  scenario?: Scenario;
  historischStartjaar?: number;
  einddatum?: string;
}

export interface Berekening {
  eersteTermijn: { bruto: number; netto: number };
  perJaar: { bruto: number; netto: number };
  garantierente: number;
  poliskostenPerTermijn: number;
  eenmaligeKosten: number;
  band?: { pessimistisch: number; optimistisch: number };
  leeftijd: number;
}

export interface VergelijkResultaat {
  verzekeraarId: string;
  verzekeraarNaam: string;
  demo?: boolean;
  status: "succes" | "fout";
  fouten?: string[];
  berekening?: Berekening;
  endpoint: string;
}
