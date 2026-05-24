# One atomic `leland_commit_import` tool, not granular per-row writes

The obvious shape for an MCP write surface is one tool per CRUD verb: `create_material`, `create_purchase`, etc. — mirroring the existing TanStack server functions. We rejected that for the import flow and chose a single batch tool instead.

**Decision:** The MCP exposes one write tool, `leland_commit_import`, that takes the full list of items extracted from a **Receipt** (a mix of new **Materials** and **Purchases**) and runs them inside a single Prisma `$transaction`. New materials are created and their generated ids are wired into the corresponding purchases atomically. The whole batch either lands or none of it does. Read tools remain granular.

**Why:**
- Atomicity matches the user's mental model: they confirm "import this **Receipt**" once. Partial success ("7 of 10 purchases landed, 3 failed") leaves them in a state the UI doesn't currently express and would be painful to clean up (no batch id on `Purchase`).
- Validation collapses to one round trip. Cross-row issues (e.g. a new-material name conflicting with an existing material's `unitOfMeasure`) can be reported before any write.
- Keeps the existing per-row server functions untouched. Granular MCP tools would have either duplicated them or forced a refactor in both call paths.

**Consequence worth flagging:** If the v2 scope grows to non-import use cases ("add a single ad-hoc material", "edit a single past purchase from chat"), those should be **new** tools, not bent out of `leland_commit_import`. The atomic batch shape is specifically tied to the **Import** concept.
