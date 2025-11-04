import {
  prepareSecureMessage,
  processSecureMessage,
} from "@/lib/message-crypto";

describe("message-crypto", () => {
  it("encrypts, signs, decrypts and verifies", async () => {
    const aesKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    const signKeyPair = await window.crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );

    const msg = "hello";
    const secure = await prepareSecureMessage(
      msg,
      aesKey,
      signKeyPair.privateKey,
      "1"
    );

    const { message, isAuthentic } = await processSecureMessage(
      secure,
      aesKey,
      signKeyPair.publicKey
    );

    expect(message).toBe(msg);
    expect(isAuthentic).toBe(true);
  });
});
