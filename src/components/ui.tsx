import React from "react";

// Klassieke zuil — symbool van stabiliteit en behoud. Enige "logo"-element.
export function Zuil({ size = 22, color = "#B0873A" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20.5h16" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 20.5v-1.2h14v1.2" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 19v-11M12 19v-11M16 19v-11" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 8h14M5 8l7-4 7 4" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
