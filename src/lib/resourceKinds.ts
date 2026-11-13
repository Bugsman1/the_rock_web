export const resourceKinds = ["mercury", "water", "fuel"] as const;

export type ResourceKind = (typeof resourceKinds)[number];

const kindNames: Record<ResourceKind, readonly string[]> = {
  mercury: ["mercury", "mercure", "الزئبق", "زئبق"],
  water: ["water", "eau", "الماء", "ماء", "مياه"],
  fuel: [
    "fuel",
    "essence",
    "carburant",
    "gasoil",
    "الوقود",
    "وقود",
    "المازوت",
    "مازوت",
    "البنزين",
    "بنزين",
  ],
};

const TATWEEL = "ـ";

function normalizeName(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replaceAll(TATWEEL, "")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

export function kindNamed(name: string): ResourceKind | undefined {
  const normalized = normalizeName(name);

  return resourceKinds.find((kind) =>
    kindNames[kind].some((spelling) => normalizeName(spelling) === normalized),
  );
}

export function isResourceKind(value: string): value is ResourceKind {
  return resourceKinds.some((kind) => kind === value);
}
