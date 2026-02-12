import crypto from "crypto";

export const nextHash = (prevHash: string, payload: unknown) =>
  crypto.createHash("sha256").update(`${prevHash}:${JSON.stringify(payload)}`).digest("hex");

export const verifyChain = (items: { prev_hash: string; hash: string; payload: unknown }[]) =>
  items.every((i) => nextHash(i.prev_hash, i.payload) === i.hash);
