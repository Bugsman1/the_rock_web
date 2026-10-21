import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "use-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/fr.json";
import { Drawer, DrawerActions } from "./Drawer";

describe("Drawer", () => {
  it("closes itself when it is removed while still open, such as leaving the page", () => {
    const { unmount } = render(
      <Drawer open title="Modifier l'affinage" closeLabel="Fermer" onClose={vi.fn()}>
        <p>Formulaire</p>
      </Drawer>,
    );
    const dialog = screen.getByRole("dialog", { name: "Modifier l'affinage" });

    expect(dialog).toHaveAttribute("open");

    unmount();

    expect(dialog).not.toHaveAttribute("open");
  });

  it("stays open while it is shown", () => {
    render(
      <Drawer open title="Modifier l'affinage" closeLabel="Fermer" onClose={vi.fn()}>
        <p>Formulaire</p>
      </Drawer>,
    );

    expect(screen.getByRole("dialog", { name: "Modifier l'affinage" })).toHaveAttribute("open");
    expect(screen.getByText("Formulaire")).toBeVisible();
  });
});

const discard = messages.common.discard;

function showActions(dirty: boolean, onCancel = vi.fn()) {
  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <DrawerActions
        submitting={false}
        submitIcon="plus"
        submitLabel="Enregistrer"
        savingLabel="Enregistrement"
        cancelLabel="Annuler"
        onCancel={onCancel}
        dirty={dirty}
      />
    </IntlProvider>,
  );

  return { onCancel, user: userEvent.setup() };
}

describe("DrawerActions", () => {
  it("leaves an untouched form at once", async () => {
    const { onCancel, user } = showActions(false);

    await user.click(screen.getByRole("button", { name: "Annuler" }));

    expect(onCancel).toHaveBeenCalled();
    expect(screen.queryByText(discard.question)).not.toBeInTheDocument();
  });

  it("asks before throwing away what was typed, and keeps it on request", async () => {
    const { onCancel, user } = showActions(true);

    await user.click(screen.getByRole("button", { name: "Annuler" }));

    expect(screen.getByRole("alertdialog", { name: discard.question })).toBeVisible();
    expect(onCancel).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: discard.keep }));

    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeVisible();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("leaves without saving once the user confirms", async () => {
    const { onCancel, user } = showActions(true);

    await user.click(screen.getByRole("button", { name: "Annuler" }));
    await user.click(screen.getByRole("button", { name: discard.confirm }));

    expect(onCancel).toHaveBeenCalled();
  });
});
