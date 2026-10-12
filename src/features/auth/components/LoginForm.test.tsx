import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/ar.json";
import { LoginForm } from "./LoginForm";

const replace = vi.fn();
const { signInMock } = vi.hoisted(() => ({ signInMock: vi.fn() }));

vi.mock("../signIn", () => ({ signIn: signInMock }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useReplace: () => replace,
  usePathname: () => "/login",
}));

function renderForm() {
  return render(
    <IntlProvider locale="ar" messages={messages} timeZone="Africa/Nouakchott">
      <LoginForm />
    </IntlProvider>,
  );
}

const login = messages.auth.login;

beforeEach(() => {
  replace.mockReset();
  signInMock.mockReset();
  signInMock.mockResolvedValue({ ok: true, role: "manager" });
});

const languageTrigger = () =>
  screen.getByRole("button", { name: new RegExp(messages.common.language) });

describe("LoginForm", () => {
  it("sends the typed values on and moves to the dashboard", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(login.email.label), "manager@mills.mr");
    await user.type(screen.getByLabelText(login.password.label), "secret123");
    await user.click(screen.getByRole("button", { name: login.submit }));

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith({
        email: "manager@mills.mr",
        password: "secret123",
        rememberMe: false,
      });
    });

    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(screen.queryByRole("button", { name: login.submit })).toBeNull();
    expect(screen.getByRole("status", { name: login.submitting })).toBeInTheDocument();
    expect(screen.queryByText(login.errors.emailRequired)).toBeNull();
  });

  it("opens the shipments for a supervisor", async () => {
    signInMock.mockResolvedValue({ ok: true, role: "supervisor" });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(login.email.label), "supervisor@mills.mr");
    await user.type(screen.getByLabelText(login.password.label), "secret123");
    await user.click(screen.getByRole("button", { name: login.submit }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/shipments");
    });
  });

  it("shows the credentials error and keeps the form when sign in fails", async () => {
    signInMock.mockResolvedValue({ ok: false, reason: "invalidCredentials" });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(login.email.label), "manager@mills.mr");
    await user.type(screen.getByLabelText(login.password.label), "secret123");
    await user.click(screen.getByRole("button", { name: login.submit }));

    expect(await screen.findByRole("alert")).toHaveTextContent(login.errors.invalidCredentials);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText(login.email.label)).toHaveValue("manager@mills.mr");
    expect(screen.getByRole("button", { name: login.submit })).toBeVisible();
    expect(screen.queryByRole("status", { name: login.submitting })).toBeNull();
  });

  it("shows the loading dots instead of the button while the server checks", async () => {
    let answer: (result: { ok: false; reason: "invalidCredentials" }) => void = () => {};
    signInMock.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(login.email.label), "manager@mills.mr");
    await user.type(screen.getByLabelText(login.password.label), "secret123");
    await user.click(screen.getByRole("button", { name: login.submit }));

    expect(await screen.findByRole("status", { name: login.submitting })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: login.submit })).toBeNull();

    answer({ ok: false, reason: "invalidCredentials" });

    expect(await screen.findByRole("button", { name: login.submit })).toBeVisible();
  });

  it("says when the server cannot be reached", async () => {
    signInMock.mockResolvedValue({ ok: false, reason: "unavailable" });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(login.email.label), "manager@mills.mr");
    await user.type(screen.getByLabelText(login.password.label), "secret123");
    await user.click(screen.getByRole("button", { name: login.submit }));

    expect(await screen.findByRole("alert")).toHaveTextContent(login.errors.unavailable);
    expect(replace).not.toHaveBeenCalled();
  });

  it("says when the account has no role allowed in the app", async () => {
    signInMock.mockResolvedValue({ ok: false, reason: "noAccess" });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(login.email.label), "cashier@mills.mr");
    await user.type(screen.getByLabelText(login.password.label), "secret123");
    await user.click(screen.getByRole("button", { name: login.submit }));

    expect(await screen.findByRole("alert")).toHaveTextContent(login.errors.noAccess);
    expect(replace).not.toHaveBeenCalled();
  });

  it("blocks an empty submit with field level errors", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: login.submit }));

    expect(await screen.findByText(login.errors.emailRequired)).toBeVisible();
    expect(screen.getByText(login.errors.passwordRequired)).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("rejects a malformed email", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(login.email.label), "not-an-email");
    await user.type(screen.getByLabelText(login.password.label), "secret123");
    await user.click(screen.getByRole("button", { name: login.submit }));

    expect(await screen.findByText(login.errors.emailInvalid)).toBeVisible();
  });

  it("toggles the password between hidden and visible", async () => {
    const user = userEvent.setup();
    renderForm();

    const field = screen.getByLabelText(login.password.label);
    expect(field).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: messages.common.showPassword }));
    expect(field).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: messages.common.hidePassword }));
    expect(field).toHaveAttribute("type", "password");
  });
  it("points users without an account at their supervisor", () => {
    renderForm();

    expect(screen.getByText(login.contactAdmin)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Google/i })).toBeNull();
  });

  it("keeps the language menu closed until it is opened", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByRole("link", { name: /Français/ })).toBeNull();

    await user.click(languageTrigger());

    expect(screen.getByRole("link", { name: /Français/ })).toBeVisible();
    expect(screen.getByRole("link", { name: /العربية/ })).toBeVisible();
  });

  it("marks the active language and links the other to the current page", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(languageTrigger());

    expect(screen.getByRole("link", { name: /العربية/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: /Français/ })).toHaveAttribute("href", "/login");
  });

  it("closes the language menu on Escape", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(languageTrigger());
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("link", { name: /Français/ })).toBeNull();
  });

  it("toggles the remember me checkbox", async () => {
    const user = userEvent.setup();
    renderForm();

    const checkbox = screen.getByLabelText(login.rememberMe);

    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });
  it("marks an invalid field so it can be styled as an error", async () => {
    const user = userEvent.setup();
    renderForm();

    const email = screen.getByLabelText(login.email.label);

    expect(email).not.toHaveAttribute("aria-invalid");

    await user.click(screen.getByRole("button", { name: login.submit }));

    expect(await screen.findByText(login.errors.emailRequired)).toBeVisible();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription(login.errors.emailRequired);
  });
});
