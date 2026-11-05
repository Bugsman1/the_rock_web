import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { MultiSelect } from "./MultiSelect";

const options = [
  { value: "pending", label: "En attente" },
  { value: "grinding", label: "Broyage" },
  { value: "refining", label: "Raffinage" },
];

function Statuses() {
  const [chosen, setChosen] = useState<readonly string[]>([]);

  return (
    <>
      <MultiSelect
        id="status"
        label="Statut"
        allLabel="Tous"
        options={options}
        chosen={chosen}
        onToggle={(value) =>
          setChosen((current) =>
            current.includes(value)
              ? current.filter((item) => item !== value)
              : [...current, value],
          )
        }
      />
      <p>dehors</p>
    </>
  );
}

function renderStatuses() {
  render(<Statuses />);

  return { user: userEvent.setup(), field: screen.getByRole("button", { name: "Statut" }) };
}

describe("MultiSelect", () => {
  it("shows all until a choice is ticked, then the ticked choices", async () => {
    const { user, field } = renderStatuses();
    expect(field).toHaveTextContent("Tous");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    await user.click(field);
    await user.click(screen.getByRole("checkbox", { name: "En attente" }));
    await user.click(screen.getByRole("checkbox", { name: "Raffinage" }));

    expect(field).toHaveTextContent("En attente, Raffinage");
    expect(field).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("checkbox", { name: "En attente" }));
    expect(field).toHaveTextContent("Raffinage");
  });

  it("closes from its field, with Escape and on a click outside", async () => {
    const { user, field } = renderStatuses();

    await user.click(field);
    await user.click(field);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    await user.click(field);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    await user.click(field);
    await user.click(screen.getByText("dehors"));
    expect(field).toHaveAttribute("aria-expanded", "false");
  });
});
