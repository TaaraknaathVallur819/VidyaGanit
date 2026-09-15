// Shared catalog of maths concepts/formulae for Classes 4–7. Used by the Concept
// Library, the Formula Flashcards, and bookmark labels. Names/descriptions are
// i18n keys; the formula and example are symbolic so they read the same in every
// language.

export type ConceptCategory =
  | "arithmetic"
  | "fractions"
  | "percentage"
  | "geometry"
  | "algebra";

export type Concept = {
  id: string;
  category: ConceptCategory;
  nameKey: string;
  descKey: string;
  formula: string;
  example: string;
};

export const CONCEPTS: Concept[] = [
  {
    id: "fractionAdd",
    category: "fractions",
    nameKey: "concept.item.fractionAdd.name",
    descKey: "concept.item.fractionAdd.desc",
    formula: "a/b + c/d = (a·d + c·b) / (b·d)",
    example: "1/2 + 1/3 = 5/6",
  },
  {
    id: "fractionMul",
    category: "fractions",
    nameKey: "concept.item.fractionMul.name",
    descKey: "concept.item.fractionMul.desc",
    formula: "a/b × c/d = (a·c) / (b·d)",
    example: "2/3 × 3/4 = 6/12 = 1/2",
  },
  {
    id: "decimalPlace",
    category: "fractions",
    nameKey: "concept.item.decimalPlace.name",
    descKey: "concept.item.decimalPlace.desc",
    formula: "0.1 = 1/10,  0.01 = 1/100",
    example: "3.45 = 3 + 4/10 + 5/100",
  },
  {
    id: "percentage",
    category: "percentage",
    nameKey: "concept.item.percentage.name",
    descKey: "concept.item.percentage.desc",
    formula: "x% of N = (x / 100) × N",
    example: "20% of 50 = (20/100) × 50 = 10",
  },
  {
    id: "average",
    category: "arithmetic",
    nameKey: "concept.item.average.name",
    descKey: "concept.item.average.desc",
    formula: "Mean = (sum of values) / (number of values)",
    example: "(4 + 6 + 8) / 3 = 6",
  },
  {
    id: "simpleInterest",
    category: "arithmetic",
    nameKey: "concept.item.simpleInterest.name",
    descKey: "concept.item.simpleInterest.desc",
    formula: "SI = (P × R × T) / 100",
    example: "P=1000, R=5%, T=2 → SI = 100",
  },
  {
    id: "rectArea",
    category: "geometry",
    nameKey: "concept.item.rectArea.name",
    descKey: "concept.item.rectArea.desc",
    formula: "Area = length × width",
    example: "5 × 3 = 15 sq units",
  },
  {
    id: "rectPerimeter",
    category: "geometry",
    nameKey: "concept.item.rectPerimeter.name",
    descKey: "concept.item.rectPerimeter.desc",
    formula: "Perimeter = 2 × (length + width)",
    example: "2 × (5 + 3) = 16 units",
  },
  {
    id: "triangleArea",
    category: "geometry",
    nameKey: "concept.item.triangleArea.name",
    descKey: "concept.item.triangleArea.desc",
    formula: "Area = ½ × base × height",
    example: "½ × 6 × 4 = 12 sq units",
  },
  {
    id: "circleArea",
    category: "geometry",
    nameKey: "concept.item.circleArea.name",
    descKey: "concept.item.circleArea.desc",
    formula: "Area = π × r²",
    example: "π × 7² = 154 sq units (π ≈ 22/7)",
  },
  {
    id: "circleCircum",
    category: "geometry",
    nameKey: "concept.item.circleCircum.name",
    descKey: "concept.item.circleCircum.desc",
    formula: "Circumference = 2 × π × r",
    example: "2 × 22/7 × 7 = 44 units",
  },
  {
    id: "linearEq",
    category: "algebra",
    nameKey: "concept.item.linearEq.name",
    descKey: "concept.item.linearEq.desc",
    formula: "x + a = b  →  x = b − a",
    example: "x + 5 = 12 → x = 7",
  },
];

export const CONCEPT_CATEGORIES: { id: ConceptCategory; key: string }[] = [
  { id: "arithmetic", key: "concept.cat.arithmetic" },
  { id: "fractions", key: "concept.cat.fractions" },
  { id: "percentage", key: "concept.cat.percentage" },
  { id: "geometry", key: "concept.cat.geometry" },
  { id: "algebra", key: "concept.cat.algebra" },
];

const CONCEPT_BY_ID = new Map<string, Concept>(CONCEPTS.map((c) => [c.id, c]));

export function conceptById(id: string): Concept | undefined {
  return CONCEPT_BY_ID.get(id);
}
