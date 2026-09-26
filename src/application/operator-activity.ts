import { withPostgresClient } from "../db/postgres";
import {
  capabilityFailure,
  capabilityOk,
  type CapabilityResult,
} from "./result";

export interface OperatorAddressActivity {
  id: string;
  address_id: string;
  activity_type: "note_added";
  body: string;
  actor_email: string;
  created_at: string;
}

function normalizeNoteBody(body: unknown): string | null {
  if (typeof body !== "string") return null;
  const normalized = body.trim();
  if (normalized.length < 1 || normalized.length > 4000) {
    return null;
  }
  return normalized;
}

export async function addOperatorAddressNote(
  database: Hyperdrive,
  addressId: string,
  body: unknown,
  actorEmail: string,
): Promise<CapabilityResult<OperatorAddressActivity>> {
  const normalizedBody = normalizeNoteBody(body);
  if (!normalizedBody) {
    return capabilityFailure("operator_note_invalid", {
      min_length: 1,
      max_length: 4000,
    });
  }

  return withPostgresClient(database, async (client) => {
    const address = await client.query<{ id: string }>(
      `
        SELECT id
        FROM addresses
        WHERE id = $1
        LIMIT 1
      `,
      [addressId],
    );

    if (!address.rows[0]) {
      return capabilityFailure("operator_address_not_found", {
        address_id: addressId,
      });
    }

    const inserted = await client.query<{
      id: string;
      address_id: string;
      activity_type: "note_added";
      body: string;
      actor_email: string;
      created_at: Date | string;
    }>(
      `
        INSERT INTO operator_address_activity (
          address_id,
          activity_type,
          body,
          actor_email
        )
        VALUES ($1, 'note_added', $2, $3)
        RETURNING
          id,
          address_id,
          activity_type,
          body,
          actor_email,
          created_at
      `,
      [addressId, normalizedBody, actorEmail],
    );

    const row = inserted.rows[0];
    return capabilityOk({
      ...row,
      created_at: new Date(row.created_at).toISOString(),
    });
  });
}

export async function getOperatorAddressActivity(
  database: Hyperdrive,
  addressId: string,
  limit = 50,
): Promise<CapabilityResult<{
  address_id: string;
  count: number;
  items: OperatorAddressActivity[];
}>> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);

  return withPostgresClient(database, async (client) => {
    const address = await client.query<{ id: string }>(
      `
        SELECT id
        FROM addresses
        WHERE id = $1
        LIMIT 1
      `,
      [addressId],
    );

    if (!address.rows[0]) {
      return capabilityFailure("operator_address_not_found", {
        address_id: addressId,
      });
    }

    const activity = await client.query<{
      id: string;
      address_id: string;
      activity_type: "note_added";
      body: string;
      actor_email: string;
      created_at: Date | string;
    }>(
      `
        SELECT
          id,
          address_id,
          activity_type,
          body,
          actor_email,
          created_at
        FROM operator_address_activity
        WHERE address_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2
      `,
      [addressId, safeLimit],
    );

    const items = activity.rows.map((row) => ({
      ...row,
      created_at: new Date(row.created_at).toISOString(),
    }));

    return capabilityOk({
      address_id: addressId,
      count: items.length,
      items,
    });
  });
}
