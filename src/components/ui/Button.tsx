import type { ComponentPropsWithoutRef } from "react";
import { buttonClasses } from "./buttonClasses";
import type { ButtonVariant, ButtonWidth } from "./buttonClasses";

type ButtonProps = Omit<ComponentPropsWithoutRef<"button">, "className"> & {
  variant: ButtonVariant;
  width?: ButtonWidth;
};

export function Button({ variant, width = "full", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, width)} {...props} />;
}
