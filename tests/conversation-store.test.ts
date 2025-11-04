import {
  saveConversationKeys,
  getConversationWithUser,
  getConversationWithConvId,
  loadConversationKeys,
  updateConversationWithTheirKey,
  getAllConversations,
  getConversationData,
} from "@/lib/conversation-store";

describe("conversation-store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves, finds and loads conversation keys", async () => {
    const symKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const signKeyPair = await window.crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );

    const convId = await saveConversationKeys(
      123,
      symKey,
      signKeyPair,
      undefined,
      true,
      "DIRECT",
      "99"
    );
    expect(convId).toBe(123);

    const foundByUser = getConversationWithUser("99");
    expect(foundByUser).toBeTruthy();

    const notGroup = getConversationWithConvId(123);
    expect(notGroup).toBeNull();

    const loaded = await loadConversationKeys("123");
    expect(loaded?.convId).toBe(123);
    expect(loaded?.type).toBe("DIRECT");

    const updated = updateConversationWithTheirKey("123", {
      kty: "EC",
      crv: "P-256",
      x: "x",
      y: "y",
      ext: true,
    });
    expect(updated).toBe(true);

    const all = getAllConversations();
    expect(all[123]).toBeTruthy();
  });

  it("supports group conversations lookup by id", async () => {
    const symKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const signKeyPair = await window.crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );

    await saveConversationKeys(
      200,
      symKey,
      signKeyPair,
      undefined,
      true,
      "GROUP"
    );
    const found = getConversationWithConvId(200);
    expect(found).toBeTruthy();
  });

  it("gets conversation data", async () => {
    const symKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const signKeyPair = await window.crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );

    await saveConversationKeys(300, symKey, signKeyPair);
    const data = getConversationData("300");
    expect(data).toBeTruthy();
    expect(getConversationData("999")).toBeNull();
  });
});
