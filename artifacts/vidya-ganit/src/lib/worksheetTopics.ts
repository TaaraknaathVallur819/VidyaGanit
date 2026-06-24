// Client-side mirror of the api-server NCERT-aligned curriculum (curriculum.ts):
// which math topics each class studies. Used to constrain the worksheet topic
// list to the selected student's class so a Class 4 sheet never offers "ratio"
// and a Class 7 sheet doesn't miss "algebra". The curriculum is common across
// Indian boards, so the board affects labelling/sequencing, not the topic set.

export type WorksheetTopicKey =
  | "add_subtract"
  | "multiply"
  | "divide"
  | "fraction"
  | "decimal"
  | "percent"
  | "ratio"
  | "algebra"
  | "geometry";

const ALL_TOPICS: WorksheetTopicKey[] = [
  "add_subtract",
  "multiply",
  "divide",
  "fraction",
  "decimal",
  "percent",
  "ratio",
  "algebra",
  "geometry",
];

export const CLASS_TOPICS: Record<string, WorksheetTopicKey[]> = {
  "4": ["add_subtract", "multiply", "divide", "fraction", "geometry"],
  "5": ["multiply", "divide", "fraction", "decimal", "geometry"],
  "6": ["add_subtract", "divide", "fraction", "ratio", "percent", "algebra", "geometry"],
  "7": ["add_subtract", "fraction", "ratio", "percent", "algebra", "geometry"],
};

export const TOPIC_I18N: Record<WorksheetTopicKey, string> = {
  add_subtract: "test.topic.add_subtract",
  multiply: "test.topic.multiply",
  divide: "test.topic.divide",
  fraction: "test.topic.fraction",
  decimal: "test.topic.decimal",
  percent: "test.topic.percent",
  ratio: "test.topic.ratio",
  algebra: "test.topic.algebra",
  geometry: "test.topic.geometry",
};

export function topicsForClass(
  klass: string | null | undefined,
): WorksheetTopicKey[] {
  if (klass && CLASS_TOPICS[klass]) return CLASS_TOPICS[klass];
  return ALL_TOPICS;
}
