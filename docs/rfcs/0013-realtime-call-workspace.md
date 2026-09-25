# RFC 0013 - Real-time Call Workspace

Date: 2026-09-25
Status: Future idea - not scheduled

## Context

Netco already treats an address as a central operating object for provider coverage,
availability, evidence, freshness, and future serviceability decisions.

A natural future extension is to connect an incoming customer call to the same
address intelligence in near real time.

The goal is not to create a separate call CRM.

The goal is to let telephony act as another input channel into Netco.

## Product idea

When a customer calls:

```text
incoming call
  -> Netco call workspace opens
  -> caller is identified when possible
  -> operator asks for the service address
  -> address is entered or extracted from live speech
  -> Netco resolves the address
  -> existing address intelligence is loaded immediately
```

The operator could then see, on one screen:

```text
normalized address
own network coverage
nearest known infrastructure
estimated extension distance
serviceability / buildability
estimated activation effort
known competing providers
evidence freshness and confidence
existing customer / lead context
```

The response should come from Netco's persisted projections and evidence,
not from live scraping of third-party providers during the call.

## Architectural direction

Telephony should be provider-neutral.

Potential integrations may include Ukrainian PBX / cloud telephony providers such
as Binotel, Ringostat, Phonet, UniTalk, Zadarma, or future alternatives.

A future adapter boundary could normalize provider-specific events into Netco events:

```text
call.started
call.ringing
call.answered
call.transcript.partial
call.transcript.final
call.ended
recording.available
```

The core Netco domain should not depend on a specific telephony vendor.

## Address input

Speech recognition is optional.

The same address-resolution pipeline should accept both:

```text
operator typed address
live/final speech transcript
```

Both paths should converge on the existing canonical address model before any
coverage or serviceability lookup occurs.

This keeps speech/AI outside the core address intelligence boundary.

## Important boundary

A customer call must not trigger uncontrolled real-time probing or scraping of
competitor/provider websites.

Preferred flow:

```text
controlled collection
  -> evidence
  -> persisted projections
  -> address intelligence

incoming call
  -> resolved address
  -> fast projection query
```

This allows near-real-time operator UX without coupling call latency to external
provider systems.

## Possible future domain concepts

If this direction is implemented later, likely concepts include:

```text
Call
CallParticipant
CallGateway
Lead / Opportunity
AddressCandidate
ServiceabilityAssessment
Transcript
```

These names are exploratory and are not schema decisions.

## Possible future vertical slice

A minimal implementation could eventually be:

1. Receive `call.started` webhook.
2. Open or focus a Netco call workspace.
3. Resolve caller ID to an existing customer or lead when possible.
4. Let the operator type and resolve an address.
5. Query Netco's existing address intelligence.
6. Show coverage, evidence, freshness, map context, and serviceability data.
7. Persist call metadata and associate it with the lead/customer.

Live transcription and AI extraction should be later enhancements, not prerequisites.

## Non-decision

This RFC does not add work to the current implementation plan.

It does not introduce:

- new production tables;
- telephony dependencies;
- speech-to-text infrastructure;
- a specific PBX vendor;
- a new current vertical slice;
- changes to the current address/coverage implementation sequence.

It exists only to preserve the product and architecture direction for future
prioritization.

## Revisit when

Reconsider this RFC when Netco has sufficiently mature:

- address-centric operator UI;
- coverage and serviceability projections;
- customer/lead workflow;
- enough production data to make the call workspace useful.

At that point the first decision should be the telephony adapter contract and the
smallest provider-independent screen-pop vertical slice.
