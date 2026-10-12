import { createContext, use } from "react";
import { can, noAccess } from "./access";
import type { Access, Module, Right } from "./access";

export const AccessContext = createContext<Access>(noAccess);

export function useCan(): (module: Module, right: Right) => boolean {
  const access = use(AccessContext);

  return (module, right) => can(access, module, right);
}
