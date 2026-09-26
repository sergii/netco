BEGIN;

CREATE TABLE operator_address_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address_id uuid NOT NULL REFERENCES addresses(id),
  activity_type text NOT NULL
    CHECK (activity_type IN ('note_added')),
  body text NOT NULL
    CHECK (
      length(btrim(body)) BETWEEN 1 AND 4000
    ),
  actor_email text NOT NULL
    CHECK (length(btrim(actor_email)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX operator_address_activity_address_created_idx
  ON operator_address_activity (
    address_id,
    created_at DESC,
    id DESC
  );

REVOKE ALL ON TABLE operator_address_activity FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE operator_address_activity
  TO "hyperdrive-user";
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE operator_address_activity
  FROM "hyperdrive-user";

COMMIT;
