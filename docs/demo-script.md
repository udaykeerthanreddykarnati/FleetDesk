# Five-minute project demonstration

Before the demonstration, start MySQL/PostgreSQL, Ollama, and Next.js as described in the README. Seed the fictional records, sync vectors, and sign in as Admin.

1. **Dashboard:** point out that fleet counts, active trips, delivered shipments, maintenance spend, fuel cost, other costs, shipment statuses, and incidents are live database results.
2. **Vehicles and drivers:** filter records. Add a test vehicle and driver with unique registration/license values; show server validation on an invalid capacity or duplicate key.
3. **Shipments:** search for a term such as `ceramics` to demonstrate MySQL FULLTEXT. Attempt to set a pending shipment directly to delivered and show that the status rule rejects it.
4. **Trips:** create a trip with one pending shipment. First assign an unavailable/missing vehicle or driver and show the rejected request leaves the trip planned. Assign an eligible vehicle and driver; point out that MySQL updates trip, vehicle, driver, and shipment rows atomically.
5. **Maintenance and expenses:** add a service record and fuel expense. Show the vehicle’s service status and the changed report totals.
6. **Images:** use **Sample** on a vehicle row. The small generated sample image uploads through the UI; the page then requests it back from the MySQL BLOB endpoint. Replace it with a valid image and delete it. The integration test also compares the exact stored `image_data` bytes to the uploaded file.
7. **Incidents and vector search:** open Similar incidents, enter a phrase such as “coolant leak and high engine temperature during a delivery.” Show ranked matches and similarity values; the results are real local-model embeddings searched through pgvector.
8. **Roles:** in Admin-only User management, create an Operations account. Sign out and sign in as that account; user management is unavailable and the corresponding API returns `403`.
9. **Database artifacts:** show `mysql/001_schema.sql`, `mysql/002_programmability.sql`, and `postgres/001_vector_schema.sql`, then open the matching query examples in `docs/sql-examples.sql`.

Use disposable local records for the walkthrough. The test suite uses separate unique IDs and removes its own rows.
