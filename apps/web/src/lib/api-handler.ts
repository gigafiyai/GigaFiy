// Standard API route wrapper: validates JSON input with a zod schema, returns a
// consistent error envelope, and never lets an unhandled throw become an ugly
// stack-trace 500. Use for mutation routes that take a body.
//
//   export const POST = apiHandler({ schema, handler: async (input) => {...} });

import { NextRequest, NextResponse } from "next/server";
import type { ZodSchema } from "zod";

type Json = Record<string, unknown> | unknown[];

export function apiHandler<T>(opts: {
  schema?: ZodSchema<T>;
  handler: (input: T, req: NextRequest) => Promise<NextResponse | Response | Json>;
}) {
  return async (req: NextRequest): Promise<Response> => {
    try {
      let input = {} as T;
      if (opts.schema) {
        const body = await req.json().catch(() => ({}));
        const parsed = opts.schema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "invalid input", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
            { status: 400 }
          );
        }
        input = parsed.data;
      }
      const result = await opts.handler(input, req);
      if (result instanceof Response) return result;
      return NextResponse.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "internal error";
      console.error("[api] unhandled:", msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  };
}
