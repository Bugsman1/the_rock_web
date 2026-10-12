import type { ApiSchema } from "./api/client";

type Profile = {
  name: string;
  email: string;
  phone: string;
  roleName: string;
};

export function displayName({ full_name, email }: { full_name: string; email: string }): string {
  const name = full_name.trim();

  return name === "" ? email : name;
}

export function profileFromApi(me: ApiSchema<"Me">): Profile {
  return {
    name: displayName(me),
    email: me.email,
    phone: me.phone,
    roleName: me.role?.name ?? "",
  };
}
