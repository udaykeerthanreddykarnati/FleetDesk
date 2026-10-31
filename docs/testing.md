# Tests and verification

## Commands

Run checks from the project root:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

The API integration suite exercises the live app and real local services. Start the isolated MySQL/PostgreSQL data stores, Ollama with `nomic-embed-text`, and `npm run dev` first. Then:

```sh
export TEST_ADMIN_EMAIL=admin@example.local
export TEST_ADMIN_PASSWORD='your-local-admin-password'
npm run test:integration
unset TEST_ADMIN_EMAIL TEST_ADMIN_PASSWORD
```

The test uses unique `TST-` identifiers, verifies records through both HTTP and SQL, and cleans up test-created data. The SQL integration test must only run against this project’s local databases.

## Unit cases

`tests/core.test.ts` contains eight unit tests covering:

- Schema validation, normalization, positive quantities, and valid trip/shipment IDs.
- Legal/illegal shipment and trip status transitions.
- Salted scrypt password verification and rejection of an incorrect password.
- PNG signature detection, spoofed image rejection, safe filename handling, and the 5 MiB maximum.
- Empty pgvector results, similarity conversion, and suppression of vector IDs without a matching current MySQL incident.
- Conversion of ISO timestamps to MySQL UTC `DATETIME` values.

## API integration cases

`tests/api.integration.test.ts` runs against MySQL 9.7.1, PostgreSQL 18.6 + pgvector 0.8.7, Ollama `nomic-embed-text`, and Next.js on port 3000. Its single scenario includes assertions for:

1. App startup (`GET /login`), invalid credentials, and successful Admin login.
2. Admin-only user routes, Admin-created Operations account, and allowed/denied Operations requests.
3. Vehicle create/read/update, server-side invalid capacity rejection, and driver creation/read.
4. Shipment creation, invalid direct transition to delivered, and MySQL FULLTEXT filtering.
5. Trip creation, missing vehicle assignment rejection, valid assignment, active resource conflict rejection, and direct SQL verification that the failed trip remains `planned` with no assignments.
6. Trip progression updates linked shipments to `in_transit` and then `delivered`.
7. Maintenance and fuel expense creation/read.
8. Image rejection when MIME/name are spoofed; upload of the actual local sample image; byte-for-byte comparison between uploaded bytes, MySQL `image_data`, and retrieved response; replacement and deletion.
9. Incident create; MySQL `embedding_status='synced'`; semantic pgvector search of a natural-language query; real result/score checks; invalid short query; incident/vector deletion.

The empty vector result path is additionally covered by the unit test for `mergeVectorMatches([], [])`. An app-level search with a completely empty Postgres index is not part of the integration scenario because the demo seed index is intentionally retained.

## Results observed for this build

On 2026-10-28:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed. |
| `npm test` | Passed: 8 tests. |
| `npm run test:integration` | Passed: 1 scenario with the checks listed above. |
| `npm run build` | Passed: optimized Next.js production build using webpack. |
| `npm audit` | Passed: 0 vulnerabilities at the time checked. |
| Local seed and vector sync | Seed completed; 5 incident vectors synced, 0 failed, 0 remaining. |
| Image BLOB verification | Integration test confirmed exact byte equality before upload, in MySQL, and after retrieval. |

Tested local runtime versions: Node.js `v26.8.2`, npm `11.19.1`, MySQL `9.7.1`, PostgreSQL `18.6`, pgvector `0.8.7`, and Ollama `0.35.0`. Runtime versions may change as package managers publish updates.

## Browser verification

The local login page and authenticated dashboard were opened in the app’s browser on 2026-10-28. The dashboard displayed live seeded MySQL metrics: 5 vehicles, 4 available, 1 active trip, 1 delivered shipment, ₹38,000 maintenance spend, ₹15,800 fuel spend, and ₹3,960 other expenses. The Similar incidents page was also searched through the browser with “The truck showed a coolant leak and high engine temperature during a highway delivery.” It returned the seeded “Coolant temperature warning on highway” incident at 78.1% cosine similarity, followed by the other live vector matches. Both pages were visually reviewed; their screenshots were displayed during verification, but separate image files are not stored in this document set.

## Scope and limitations

- The integration suite hits the local Next.js server and a dedicated project data directory; it does not exercise a remote or production deployment.
- The tests do not simulate simultaneous parallel dispatch requests under heavy load. The stored procedure’s row locks and eligibility rules are exercised through valid and conflicting assignments.
- Model output can vary slightly by hardware/runtime. Tests assert the real returned incident and score bounds rather than a fixed embedding score.
- npm advisory output reflects the registry state on the recorded date; rerun `npm audit` for a later dependency state.
