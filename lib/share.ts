import "server-only";
import crypto from "node:crypto";
import { prisma } from "./prisma";

export function generateShareToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export type ShareScope = "members" | "public";
