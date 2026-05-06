"use client";

const STORAGE_KEY = "bothsafe-access-tokens";
const INVITE_STORAGE_KEY = "bothsafe-invite-links";

type TokenMap = Record<string, string>;

function readTokens(): TokenMap {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as TokenMap;
  } catch {
    return {};
  }
}

function writeTokens(tokens: TokenMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function getStoredAccessToken(publicId: string) {
  return readTokens()[publicId] ?? null;
}

export function setStoredAccessToken(publicId: string, token: string) {
  const tokens = readTokens();
  tokens[publicId] = token;
  writeTokens(tokens);
}

function readInviteLinks(): TokenMap {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(INVITE_STORAGE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as TokenMap;
  } catch {
    return {};
  }
}

export function getStoredInviteLink(publicId: string) {
  return readInviteLinks()[publicId] ?? null;
}

export function setStoredInviteLink(publicId: string, inviteUrl: string) {
  const links = readInviteLinks();
  links[publicId] = inviteUrl;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(INVITE_STORAGE_KEY, JSON.stringify(links));
  }
}
