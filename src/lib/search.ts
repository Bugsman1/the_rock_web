const NON_DIGITS = /\D/g;

type Searchable = {
  texts: readonly string[];
  phone: string;
};

export function matchesSearch({ texts, phone }: Searchable, query: string): boolean {
  const text = query.trim().toLocaleLowerCase();

  if (text === "") return true;

  const digits = text.replace(NON_DIGITS, "");
  const inText = texts.some((value) => value.toLocaleLowerCase().includes(text));
  const inPhone = digits !== "" && phone.replace(NON_DIGITS, "").includes(digits);

  return inText || inPhone;
}
