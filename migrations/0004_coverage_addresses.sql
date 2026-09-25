BEGIN;

CREATE TABLE addresses (
  id uuid PRIMARY KEY REFERENCES subjects(id),
  country_code text NOT NULL,
  region text,
  city text NOT NULL,
  district text,
  street text NOT NULL,
  house_number text NOT NULL,
  corpus text,
  building_letter text,
  postal_code text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  normalized_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (country_code = upper(country_code)),
  CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR
    (
      latitude BETWEEN -90 AND 90
      AND longitude BETWEEN -180 AND 180
    )
  )
);

CREATE INDEX addresses_city_street_house_idx
  ON addresses (country_code, city, street, house_number);

CREATE TABLE address_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address_id uuid NOT NULL REFERENCES addresses(id),
  value text NOT NULL,
  alias_type text NOT NULL,
  source_id uuid REFERENCES sources(id),
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from)
);

CREATE INDEX address_aliases_address_idx
  ON address_aliases (address_id);

CREATE TABLE provider_address_availability (
  provider_id uuid NOT NULL REFERENCES entities(id),
  address_id uuid NOT NULL REFERENCES addresses(id),
  service_kind text NOT NULL,
  technology text NOT NULL DEFAULT 'unknown',
  availability_state text NOT NULL
    CHECK (
      availability_state IN (
        'orderable',
        'service_available',
        'unavailable',
        'needs_verification',
        'unknown'
      )
    ),
  observed_at timestamptz NOT NULL,
  fresh_until timestamptz,
  supporting_claim_id uuid NOT NULL REFERENCES claims(id),
  projection_version text NOT NULL,
  rebuilt_at timestamptz NOT NULL,
  PRIMARY KEY (
    provider_id,
    address_id,
    service_kind,
    technology
  )
);

CREATE INDEX provider_address_availability_address_idx
  ON provider_address_availability (
    address_id,
    availability_state,
    provider_id
  );

CREATE INDEX provider_address_availability_provider_idx
  ON provider_address_availability (
    provider_id,
    availability_state,
    address_id
  );

COMMIT;
