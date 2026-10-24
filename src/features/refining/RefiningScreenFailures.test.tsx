import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import messages from "@/messages/fr.json";
import {
  API,
  openAt,
  page,
  panel,
  refined,
  serveRefiningApi,
  server,
  text,
} from "./refiningTesting";

serveRefiningApi();

describe("RefiningScreen when data fails or changes", () => {
  it("offers no queue and no refining form while the refinings cannot be loaded", async () => {
    server.use(
      http.get(`${API}/refining-operations/`, () => new HttpResponse(null, { status: 500 })),
    );
    openAt("/fr/refining/projects/3?grinding=2");

    expect(await screen.findByRole("alert")).toHaveTextContent(messages.errors.failed.description);
    expect(screen.queryByRole("heading", { name: text.queueTitle })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("SH-3")).not.toBeInTheDocument();
  });

  it("shows the queue again once the refinings load on retry", async () => {
    let failing = true;
    server.use(
      http.get(`${API}/refining-operations/`, () =>
        failing ? new HttpResponse(null, { status: 500 }) : page([refined]),
      ),
    );
    openAt("/fr/refining/projects/3");
    const user = userEvent.setup();

    await screen.findByRole("alert");
    failing = false;
    await user.click(screen.getByRole("button", { name: messages.errors.retry }));

    await screen.findByRole("heading", { name: text.queueTitle });
    expect(panel(text.queueTitle).getByText("SH-2")).toBeVisible();
    expect(panel(text.queueTitle).queryByText("SH-3")).toBeNull();
  });

  it("shows the error page instead of empty counts when the refinings cannot be loaded", async () => {
    server.use(
      http.get(`${API}/refining-operations/`, () => new HttpResponse(null, { status: 500 })),
    );
    openAt("/fr/refining");

    expect(await screen.findByRole("alert")).toHaveTextContent(messages.errors.failed.description);
    expect(screen.queryByRole("region", { name: text.overview.title })).not.toBeInTheDocument();
  });

  it("closes the form and says so when the reload shows the refining is gone", async () => {
    let refinings = [refined];
    server.use(
      http.get(`${API}/refining-operations/`, () => page(refinings)),
      http.patch(`${API}/refining-operations/9/`, () => {
        refinings = [];
        return HttpResponse.json({ detail: "Not found." }, { status: 404 });
      }),
    );
    openAt("/fr/refining/projects/3?edit=9");
    const user = userEvent.setup();

    const dialog = within(await screen.findByRole("dialog", { name: text.editTitle }));
    await user.clear(dialog.getByLabelText(text.fields.goldWithoutMaterial));
    await user.type(dialog.getByLabelText(text.fields.goldWithoutMaterial), "12");
    await user.click(dialog.getByRole("button", { name: text.form.saveChanges }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: text.editTitle })).not.toBeInTheDocument();
    });
    expect(
      await screen.findByText(messages.common.recordChanged, { ignore: "[hidden]" }),
    ).toBeInTheDocument();
  });

  it("keeps the form open with the server's message when the refining is still there", async () => {
    server.use(
      http.patch(`${API}/refining-operations/9/`, () =>
        HttpResponse.json({ non_field_errors: ["Poids incohérent."] }, { status: 400 }),
      ),
    );
    openAt("/fr/refining/projects/3?edit=9");
    const user = userEvent.setup();

    const dialog = within(await screen.findByRole("dialog", { name: text.editTitle }));
    await user.clear(dialog.getByLabelText(text.fields.goldWithoutMaterial));
    await user.type(dialog.getByLabelText(text.fields.goldWithoutMaterial), "12");
    await user.click(dialog.getByRole("button", { name: text.form.saveChanges }));

    expect(await dialog.findByText("Poids incohérent.")).toBeVisible();
    expect(dialog.getByLabelText(text.fields.goldWithoutMaterial)).toHaveValue(12);
    expect(screen.queryByText(messages.common.recordChanged)).not.toBeInTheDocument();
  });

  it("shows the error page, not a changed-data message, when the reload after a refusal fails", async () => {
    let failing = false;
    server.use(
      http.get(`${API}/refining-operations/`, () =>
        failing ? new HttpResponse(null, { status: 500 }) : page([refined]),
      ),
      http.patch(`${API}/refining-operations/9/`, () => {
        failing = true;
        return HttpResponse.json({ non_field_errors: ["Poids incohérent."] }, { status: 400 });
      }),
    );
    openAt("/fr/refining/projects/3?edit=9");
    const user = userEvent.setup();

    const dialog = within(await screen.findByRole("dialog", { name: text.editTitle }));
    await user.clear(dialog.getByLabelText(text.fields.goldWithoutMaterial));
    await user.type(dialog.getByLabelText(text.fields.goldWithoutMaterial), "12");
    await user.click(dialog.getByRole("button", { name: text.form.saveChanges }));

    expect(await screen.findByRole("button", { name: messages.errors.retry })).toBeVisible();
    expect(screen.queryByText(messages.common.recordChanged)).not.toBeInTheDocument();
  });
});
