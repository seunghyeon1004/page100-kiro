import { z } from "zod";

// The recorded-draft file format (ai-editor requirement 13.1, design.md, "Fixtures and recording").

export const DraftResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({
    ok: z.literal(true),
    rows: z.array(z.string()),
    requests: z.number().int().min(0),
  }),
  z.strictObject({
    ok: z.literal(false),
    reason: z.enum([
      "refusal",
      "max-tokens",
      "malformed",
      "rate-limited",
      "auth",
      "status",
      "timeout",
      "connection",
      "unknown",
      "no-fixture",
    ]),
    status: z.number().int().nullable(),
    requests: z.number().int().min(0),
  }),
]);

export const EditorFixture = z.strictObject({
  version: z.literal(1),
  page: z.number().int(),
  inputKey: z.string().regex(/^[0-9a-f]{64}$/),
  model: z.string().min(1),
  recordedAt: z.iso.datetime(),
  system: z.string(),
  attempts: z
    .array(z.strictObject({ user: z.string(), result: DraftResultSchema }))
    .min(1)
    .max(3),
});
export type EditorFixture = z.infer<typeof EditorFixture>;
