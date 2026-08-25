import { NextResponse } from "next/server";
import { z } from "zod";
import { sql, PG, sqlstateOf, withDeadlockRetry } from "@/db/client";
import { currentUser } from "@/lib/session";
import { publish } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ waitlistId: z.string().uuid() });

/**
 * Claim a slot that was offered after somebody cancelled.
 *
 * The offer is a promise that the slot was free when it was made, not that it
 * still is. Between the offer and the tap, a manager could have blocked the
 * court for maintenance. So the claim is a normal constrained INSERT: if it
 * loses, the student is told plainly rather than handed a booking that does
 * not exist.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const result = await withDeadlockRetry(() =>
      sql.begin(async (tx) => {
        // Lock the offer so two taps cannot both consume it, and re-check the
        // expiry inside the transaction rather than trusting what the page
        // rendered some seconds ago.
        const [offer] = await tx<
          {
            id: string; facility_id: string;
            starts_at: string; ends_at: string; expired: boolean;
          }[]
        >`
          SELECT id, facility_id,
                 lower(during) AS starts_at, upper(during) AS ends_at,
                 (claim_expires_at IS NOT NULL AND claim_expires_at < now())
                   AS expired
          FROM waitlist
          WHERE id = ${parsed.data.waitlistId}
            AND user_id = ${user.id}
            AND state = 'offered'
          FOR UPDATE
        `;
        if (!offer) {
          // No live offer — but this may be the same claim arriving twice
          // (double tap, or a retry after a timeout). The claim writes a
          // booking under a key derived from the offer, so if that booking
          // exists the honest answer is the original booking, not an error.
          const [already] = await tx<{ booking_code: string }[]>`
            SELECT booking_code FROM bookings
            WHERE idempotency_key = ${`claim-${parsed.data.waitlistId}`}
              AND user_id = ${user.id}
              AND status = 'confirmed'
          `;
          if (already) {
            return {
              ok: true as const,
              bookingCode: already.booking_code,
              replayed: true,
              facilityId: null,
            };
          }
          return { ok: false as const, code: "NO_OFFER" as const };
        }

        if (offer.expired) {
          await tx`
            UPDATE waitlist SET state = 'expired' WHERE id = ${offer.id}
          `;
          return { ok: false as const, code: "OFFER_EXPIRED" as const };
        }

        const [booking] = await tx<{ id: string; booking_code: string }[]>`
          INSERT INTO bookings (facility_id, user_id, during, idempotency_key)
          VALUES (${offer.facility_id},
                  ${user.id},
                  tstzrange(${offer.starts_at}::timestamptz,
                            ${offer.ends_at}::timestamptz, '[)'),
                  ${`claim-${offer.id}`})
          RETURNING id, booking_code
        `;

        await tx`UPDATE waitlist SET state = 'claimed' WHERE id = ${offer.id}`;

        await tx`
          INSERT INTO booking_events (booking_id, facility_id, user_id, type, payload)
          VALUES (${booking.id}, ${offer.facility_id}, ${user.id},
                  'waitlist.claimed', '{}'::jsonb)
        `;

        return {
          ok: true as const,
          bookingCode: booking.booking_code,
          replayed: false,
          facilityId: offer.facility_id as string | null,
        };
      }),
    );

    if (result.ok) {
      if (result.facilityId) {
        publish({ type: "booking", facilityId: result.facilityId });
      }
      return NextResponse.json(result);
    }
    return NextResponse.json(result, { status: 409 });
  } catch (e) {
    // The slot went away between the offer and the tap.
    if (sqlstateOf(e) === PG.EXCLUSION_VIOLATION) {
      await sql`
        UPDATE waitlist SET state = 'expired'
        WHERE id = ${parsed.data.waitlistId}
      `;
      return NextResponse.json(
        {
          ok: false,
          code: "SLOT_GONE",
          message: "That slot was taken before you claimed it.",
          sqlstate: PG.EXCLUSION_VIOLATION,
        },
        { status: 409 },
      );
    }
    // A replayed claim: the idempotency key already produced the booking.
    if (sqlstateOf(e) === PG.UNIQUE_VIOLATION) {
      const [existing] = await sql<{ booking_code: string }[]>`
        SELECT booking_code FROM bookings
        WHERE idempotency_key = ${`claim-${parsed.data.waitlistId}`}
      `;
      if (existing) {
        return NextResponse.json({
          ok: true,
          bookingCode: existing.booking_code,
          replayed: true,
        });
      }
    }
    throw e;
  }
}
