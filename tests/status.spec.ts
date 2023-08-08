import { describe, afterAll, test, expect, beforeEach } from "@jest/globals";
import { stop } from "../src";
import { fetchServer, waitForServer } from "./utils";

describe("Status checker", () => {
  beforeEach(async () => {
    await waitForServer();
  });

  afterAll(async () => {
    await stop();
  });

  test("Check all status", async () => {
    expect(await fetchServer("GET", "/api/auth/v1/status")).toBe("ok");
  });
});
