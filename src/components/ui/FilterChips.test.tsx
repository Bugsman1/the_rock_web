import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { FilterChips } from "./FilterChips";

function Chips() {
  const [value, setValue] = useState<"all" | "paid">("all");

  return (
    <FilterChips
      label="Paiement"
      chips={[
        { value: "all", label: "Tous", count: 5 },
        { value: "paid", label: "Payés", count: 2 },
      ]}
      value={value}
      onChange={setValue}
    />
  );
}

describe("FilterChips", () => {
  it("shows each choice with its count and marks the chosen one", async () => {
    const user = userEvent.setup();
    render(<Chips />);

    const group = screen.getByRole("group", { name: "Paiement" });
    const all = screen.getByRole("button", { name: "Tous 5" });
    const paid = screen.getByRole("button", { name: "Payés 2" });
    expect(group).toContainElement(all);
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(paid).toHaveAttribute("aria-pressed", "false");

    await user.click(paid);

    expect(paid).toHaveAttribute("aria-pressed", "true");
    expect(all).toHaveAttribute("aria-pressed", "false");
  });
});
