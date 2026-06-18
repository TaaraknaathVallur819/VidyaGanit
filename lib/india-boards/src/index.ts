/**
 * Canonical list of Indian school education boards, shared by the web app
 * (registration board picker) and the API server (AI tutor prompt building).
 *
 * The Classes 4–7 maths *core* is NCERT-aligned and broadly common across all
 * of these boards; depth, sequencing, vocabulary and real-life contexts vary by
 * board. This list exists so the UI can offer every board and the AI prompts can
 * be primed with the full landscape of Indian boards — not just the major ones.
 */

export type BoardCategory =
  | "national"
  | "state"
  | "ut"
  | "open"
  | "madrasa"
  | "sanskrit"
  | "international";

export interface IndiaBoard {
  /** Stable value stored on the user record (kept backward-compatible). */
  value: string;
  /** Human-readable label shown in the picker. */
  label: string;
  category: BoardCategory;
  /** State / UT the board belongs to, when applicable. */
  region?: string;
}

/** Friendly section headings for each category (used by picker + prompt). */
export const BOARD_CATEGORY_LABELS: Record<BoardCategory, string> = {
  national: "National boards",
  state: "State boards",
  ut: "Union Territory boards",
  open: "Open schooling boards",
  madrasa: "Madrasa education boards",
  sanskrit: "Sanskrit education boards",
  international: "International boards (in India)",
};

export const INDIA_BOARDS: IndiaBoard[] = [
  // ── National ──────────────────────────────────────────────────────────────
  {
    value: "CBSE",
    label: "CBSE – Central Board of Secondary Education",
    category: "national",
  },
  {
    value: "ICSE",
    label: "ICSE / ISC – Council for the Indian School Certificate Examinations (CISCE)",
    category: "national",
  },
  {
    value: "NIOS",
    label: "NIOS – National Institute of Open Schooling",
    category: "national",
  },

  // ── State boards (all 28 states) ──────────────────────────────────────────
  {
    value: "Andhra Pradesh State Board",
    label: "Andhra Pradesh – BSEAP / SCERT AP",
    category: "state",
    region: "Andhra Pradesh",
  },
  {
    value: "Arunachal Pradesh State Board",
    label: "Arunachal Pradesh – APSCERT (CBSE-aligned)",
    category: "state",
    region: "Arunachal Pradesh",
  },
  {
    value: "Assam State Board",
    label: "Assam – SEBA (Board of Secondary Education, Assam)",
    category: "state",
    region: "Assam",
  },
  {
    value: "Bihar Board (BSEB)",
    label: "Bihar – BSEB (Bihar School Examination Board)",
    category: "state",
    region: "Bihar",
  },
  {
    value: "Chhattisgarh State Board",
    label: "Chhattisgarh – CGBSE",
    category: "state",
    region: "Chhattisgarh",
  },
  {
    value: "Goa State Board",
    label: "Goa – GBSHSE",
    category: "state",
    region: "Goa",
  },
  {
    value: "Gujarat State Board",
    label: "Gujarat – GSEB",
    category: "state",
    region: "Gujarat",
  },
  {
    value: "Haryana State Board (BSEH)",
    label: "Haryana – BSEH (Board of School Education Haryana)",
    category: "state",
    region: "Haryana",
  },
  {
    value: "Himachal Pradesh State Board (HPBOSE)",
    label: "Himachal Pradesh – HPBOSE",
    category: "state",
    region: "Himachal Pradesh",
  },
  {
    value: "Jharkhand State Board (JAC)",
    label: "Jharkhand – JAC (Jharkhand Academic Council)",
    category: "state",
    region: "Jharkhand",
  },
  {
    value: "Karnataka State Board",
    label: "Karnataka – KSEAB (formerly KSEEB)",
    category: "state",
    region: "Karnataka",
  },
  {
    value: "Kerala State Board",
    label: "Kerala – KBPE / SCERT Kerala",
    category: "state",
    region: "Kerala",
  },
  {
    value: "MP Board (MPBSE)",
    label: "Madhya Pradesh – MPBSE",
    category: "state",
    region: "Madhya Pradesh",
  },
  {
    value: "Maharashtra State Board",
    label: "Maharashtra – MSBSHSE",
    category: "state",
    region: "Maharashtra",
  },
  {
    value: "Manipur State Board (BSEM)",
    label: "Manipur – BSEM (Board of Secondary Education, Manipur)",
    category: "state",
    region: "Manipur",
  },
  {
    value: "Meghalaya State Board (MBOSE)",
    label: "Meghalaya – MBOSE",
    category: "state",
    region: "Meghalaya",
  },
  {
    value: "Mizoram State Board (MBSE)",
    label: "Mizoram – MBSE",
    category: "state",
    region: "Mizoram",
  },
  {
    value: "Nagaland State Board (NBSE)",
    label: "Nagaland – NBSE",
    category: "state",
    region: "Nagaland",
  },
  {
    value: "Odisha State Board (BSE Odisha)",
    label: "Odisha – BSE Odisha",
    category: "state",
    region: "Odisha",
  },
  {
    value: "Punjab State Board (PSEB)",
    label: "Punjab – PSEB (Punjab School Education Board)",
    category: "state",
    region: "Punjab",
  },
  {
    value: "Rajasthan State Board",
    label: "Rajasthan – RBSE / BSER (Ajmer)",
    category: "state",
    region: "Rajasthan",
  },
  {
    value: "Sikkim State Board",
    label: "Sikkim – State Board (CBSE-aligned)",
    category: "state",
    region: "Sikkim",
  },
  {
    value: "Tamil Nadu State Board",
    label: "Tamil Nadu – State Board (DGE) / SCERT TN",
    category: "state",
    region: "Tamil Nadu",
  },
  {
    value: "Telangana State Board",
    label: "Telangana – BSE Telangana",
    category: "state",
    region: "Telangana",
  },
  {
    value: "Tripura State Board (TBSE)",
    label: "Tripura – TBSE",
    category: "state",
    region: "Tripura",
  },
  {
    value: "UP Board (UPMSP)",
    label: "Uttar Pradesh – UPMSP",
    category: "state",
    region: "Uttar Pradesh",
  },
  {
    value: "Uttarakhand State Board (UBSE)",
    label: "Uttarakhand – UBSE",
    category: "state",
    region: "Uttarakhand",
  },
  {
    value: "West Bengal Board",
    label: "West Bengal – WBBSE",
    category: "state",
    region: "West Bengal",
  },

  // ── Union Territory boards ────────────────────────────────────────────────
  {
    value: "Jammu & Kashmir Board (JKBOSE)",
    label: "Jammu & Kashmir – JKBOSE",
    category: "ut",
    region: "Jammu & Kashmir",
  },
  {
    value: "Delhi Board (DBSE)",
    label: "Delhi – DBSE (Delhi Board of School Education) / CBSE",
    category: "ut",
    region: "Delhi",
  },
  {
    value: "Puducherry State Board",
    label: "Puducherry – Directorate of School Education",
    category: "ut",
    region: "Puducherry",
  },
  {
    value: "Chandigarh (CBSE)",
    label: "Chandigarh – CBSE-affiliated",
    category: "ut",
    region: "Chandigarh",
  },
  {
    value: "Andaman & Nicobar (CBSE)",
    label: "Andaman & Nicobar Islands – CBSE-affiliated",
    category: "ut",
    region: "Andaman & Nicobar Islands",
  },
  {
    value: "Dadra & Nagar Haveli and Daman & Diu",
    label: "Dadra & Nagar Haveli and Daman & Diu – CBSE / GSEB",
    category: "ut",
    region: "Dadra & Nagar Haveli and Daman & Diu",
  },
  {
    value: "Lakshadweep",
    label: "Lakshadweep – Kerala board / CBSE",
    category: "ut",
    region: "Lakshadweep",
  },
  {
    value: "Ladakh",
    label: "Ladakh – CBSE / JKBOSE",
    category: "ut",
    region: "Ladakh",
  },

  // ── Open schooling boards ─────────────────────────────────────────────────
  {
    value: "AP Open School (APOSS)",
    label: "Andhra Pradesh Open School Society – APOSS",
    category: "open",
    region: "Andhra Pradesh",
  },
  {
    value: "Rajasthan State Open School (RSOS)",
    label: "Rajasthan State Open School – RSOS",
    category: "open",
    region: "Rajasthan",
  },
  {
    value: "MP State Open School (MPSOS)",
    label: "Madhya Pradesh State Open School – MPSOS",
    category: "open",
    region: "Madhya Pradesh",
  },
  {
    value: "State Open School (Other)",
    label: "Other State Open School board",
    category: "open",
  },

  // ── Madrasa education boards ──────────────────────────────────────────────
  {
    value: "UP Madarsa Board (UPBME)",
    label: "Uttar Pradesh Board of Madarsa Education – UPBME",
    category: "madrasa",
    region: "Uttar Pradesh",
  },
  {
    value: "West Bengal Madrasah Board (WBBME)",
    label: "West Bengal Board of Madrasah Education – WBBME",
    category: "madrasa",
    region: "West Bengal",
  },
  {
    value: "Bihar Madrasa Board (BSMEB)",
    label: "Bihar State Madrasa Education Board – BSMEB",
    category: "madrasa",
    region: "Bihar",
  },
  {
    value: "State Madrasa Education Board (Other)",
    label: "Other State Madrasa Education Board",
    category: "madrasa",
  },

  // ── Sanskrit education boards ─────────────────────────────────────────────
  {
    value: "State Sanskrit Education Board",
    label: "State Sanskrit Education Board (e.g. UP, Bihar, Uttarakhand)",
    category: "sanskrit",
  },

  // ── International boards present in India ──────────────────────────────────
  {
    value: "IB",
    label: "IB – International Baccalaureate",
    category: "international",
  },
  {
    value: "IGCSE",
    label: "IGCSE – Cambridge International (CAIE)",
    category: "international",
  },

  // ── Fallback ──────────────────────────────────────────────────────────────
  {
    value: "Other",
    label: "Other (please specify below)",
    category: "national",
  },
];

/** The order categories are presented in, for grouped UI + prompt rendering. */
export const BOARD_CATEGORY_ORDER: BoardCategory[] = [
  "national",
  "state",
  "ut",
  "open",
  "madrasa",
  "sanskrit",
  "international",
];

/** Boards grouped by category, in display order, omitting empty groups. */
export function boardsByCategory(): Array<{
  category: BoardCategory;
  label: string;
  boards: IndiaBoard[];
}> {
  return BOARD_CATEGORY_ORDER.map((category) => ({
    category,
    label: BOARD_CATEGORY_LABELS[category],
    boards: INDIA_BOARDS.filter(
      (b) => b.category === category && b.value !== "Other",
    ),
  })).filter((g) => g.boards.length > 0);
}

/**
 * A compact, categorised enumeration of every Indian board, used to prime the
 * AI tutor prompts so the model is explicitly aware of the full landscape of
 * Indian education boards (national, every state/UT, open schooling, madrasa,
 * sanskrit and international) — not just the major ones.
 */
export function summarizeBoardsForPrompt(): string {
  const lines: string[] = [
    "INDIAN EDUCATION BOARDS — full landscape (the Classes 4–7 maths core is NCERT-aligned and broadly common across ALL of them; depth, sequencing, vocabulary and real-life contexts vary):",
  ];
  for (const group of boardsByCategory()) {
    const names = group.boards.map((b) => b.label).join("; ");
    lines.push(`- ${group.label}: ${names}.`);
  }
  return lines.join("\n");
}
