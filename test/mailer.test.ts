import { afterEach, describe, expect, it, vi } from "vitest";

async function loadMailer() {
  vi.resetModules();
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("MAIL_FROM", "The Chat <no-reply@test.dev>");
  return import("../src/lib/mailer.js");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("mailer (Resend)", () => {
  it("envia pela API do Resend com o código", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendLoginCode } = await loadMailer();
    expect(await sendLoginCode("ana@test.com", "123456")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    const payload = JSON.parse(String(init.body));
    expect(payload).toMatchObject({ from: "The Chat <no-reply@test.dev>", to: ["ana@test.com"] });
    expect(payload.text).toContain("123456");
  });

  it("falha do Resend ou de rede não derruba a requisição", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 422 })));
    let { sendLoginCode } = await loadMailer();
    expect(await sendLoginCode("a@test.com", "123456")).toBe(false);

    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network"); }));
    ({ sendLoginCode } = await loadMailer());
    expect(await sendLoginCode("a@test.com", "123456")).toBe(false);
  });
});
