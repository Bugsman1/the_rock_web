import { isUserRole } from "./access";
import type { UserRole } from "./access";
import type { ApiSchema } from "./api/client";

type Profile = {
  name: string;
  email: string;
  phone: string;
  role: UserRole | undefined;
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
    role: isUserRole(me.role.name) ? me.role.name : undefined,
  };
}
