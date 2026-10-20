import { act, render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { describe, expect, it } from "vitest";
import { reportConnectionFailure, reportResponse } from "@/lib/api/connection";
import messages from "@/messages/ar.json";
import { ConnectionBanner } from "./ConnectionBanner";

describe("ConnectionBanner", () => {
  it("warns in red while the connection is lost and goes away once it is back", () => {
    reportResponse(200);
    render(
      <IntlProvider locale="ar" messages={messages} timeZone="Africa/Nouakchott">
        <ConnectionBanner />
      </IntlProvider>,
    );

    expect(screen.queryByRole("alert")).toBeNull();

    act(() => reportConnectionFailure());
    expect(screen.getByRole("alert")).toHaveTextContent(messages.common.connectionLost);

    act(() => reportResponse(200));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
