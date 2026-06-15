# Server services

Applies to: `src/lib/server/services/`.

## Rule

All server-side business logic lives in `src/lib/server/services/`. Remote functions, route handlers, and webhooks are thin entry points that validate input, call the service, and shape the response — they don't contain business logic themselves.

## Pattern

```ts
// src/lib/server/services/patient.service.ts
import { log } from '$lib/helpers/logger';
import type { Patient } from '$lib/schemas';

export async function createPatient(input: { name: string; birthYear: number }): Promise<Patient> {
	log.info({ name: input.name }, 'Creating patient');
	// ... call DB / SDK / external API ...
	return { id: crypto.randomUUID(), ...input };
}
```

```ts
// src/lib/remote/patient.remote.ts
import { command } from '$app/server';
import { Patient } from '$lib/schemas';
import * as patientService from '$lib/server/services/patient.service';

export const createPatient = command(Patient.omit({ id: true }), patientService.createPatient);
```

## Data access (Convex)

Services persist to **Convex** (see CLAUDE.md → Persistence), not a local store. The
pattern: validate/own the logic in the service, then call the Convex client from
`src/lib/server/data/convex.ts`:

```ts
import { api } from '$convex/_generated/api';
import { convex, ownerSecret } from '../data/convex';
import { isViewerMode } from '../env.server';

export async function listTrips(): Promise<Trip[]> {
	return (await convex().query(api.trips.listTrips, {})) as Trip[];
}

export async function deleteTrip(slug: string): Promise<void> {
	if (isViewerMode()) throw new Error('This deployment is read-only');
	await convex().mutation(api.trips.deleteTrip, { secret: ownerSecret(), slug });
}
```

Writes pass `secret: ownerSecret()` (the owner-write gate); reads don't. Trip/folder
reads are _also_ served reactively to the browser via `convex-svelte` `useQuery`, so the
service-layer read functions are used mainly for SSR and the AI agent.

## Why a service layer

- Remote functions / endpoints / webhooks can all share the same logic without duplication.
- Services are easy to unit-test in Node (Bun) — no SvelteKit bootstrap, no HTTP layer.
- If you ever need a CLI, a job runner, or a different transport, the service is reusable.

## Logging

Each service entry point should log enough context to trace a request without leaking secrets. Use `log.info({ ...context }, 'human message')` from `$lib/helpers/logger`.
