import { useState } from "react";
import type { ComponentProps } from "react";
import { Icon } from "./Icon";
import { TextField } from "./TextField";

type PasswordFieldProps = Omit<ComponentProps<typeof TextField>, "icon" | "type" | "trailing"> & {
  showLabel: string;
  hideLabel: string;
};

export function PasswordField({ showLabel, hideLabel, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      icon="lock-password"
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? hideLabel : showLabel}
          className="rounded-action text-ink-muted absolute end-0.5 top-0.5 inline-flex size-11 cursor-pointer items-center justify-center"
        >
          <Icon name={visible ? "eye-off" : "eye"} />
        </button>
      }
    />
  );
}
