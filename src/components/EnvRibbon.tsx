import type { Omgeving } from "../domain/types";

const TEKST: Record<Omgeving, { zin: string; fg: string; bg: string; dot: string }> = {
  test: { zin: "U werkt in de testomgeving. Aanroepen gaan naar de test-endpoints.", fg: "#8a6d2b", bg: "#f7efd8", dot: "#c99a3d" },
  acceptatie: { zin: "U werkt in de acceptatieomgeving. Resultaten zijn niet bindend.", fg: "#14485f", bg: "#e2eef2", dot: "#2f7c98" },
  productie: { zin: "U werkt in de productieomgeving. Aanroepen zijn echt en bindend.", fg: "#a23232", bg: "#f6e5e2", dot: "#c25151" },
};

export function EnvRibbon({ omgeving }: { omgeving: Omgeving }) {
  const t = TEKST[omgeving];
  return (
    <div className="ribbon" style={{ background: t.bg }}>
      <div className="ribbon-inner" style={{ color: t.fg }}>
        <span className="dot" style={{ background: t.dot }} />
        <span><strong>Indicatief prototype.</strong> {t.zin} Rekenwaarden zijn illustratief (mock).</span>
      </div>
    </div>
  );
}
