import { NextResponse } from "next/server";
import { z } from "zod";
import { setSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ userId: z.string().uuid() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await setSessionUser(parsed.data.userId);
  return NextResponse.json({ ok: true });
}
