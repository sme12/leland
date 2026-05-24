# MCP server is domain-only; the host LLM parses receipts

The natural-looking shape for "agent imports a receipt" is an MCP tool that accepts the file and returns structured line items — i.e. the MCP does OCR/PDF extraction. We deliberately rejected that. The MCP server only accepts structured input (material names, quantities, prices, dates) and exposes no file-receiving surface at all.

**Decision:** The host LLM (claude.ai or any MCP client with vision/PDF support) is responsible for reading the **Receipt** and producing structured line items. Leland's MCP tools (`leland_list_materials`, `leland_list_purchases`, `leland_commit_import`) only deal in Leland-domain primitives.

**Why:**
- Claude reads receipts natively and well; an OCR pipeline on Leland's side would be infrastructure we have to build, host, and maintain.
- The **Receipt** never lands on Leland's servers — privacy-positive and keeps the data surface small.
- Per Anthropic's MCP guidance, servers should expose one domain well rather than chain together unrelated capabilities.

**Consequence worth flagging:** A future engineer looking at the import flow may be tempted to "complete" it by adding a `parse_receipt(file)` tool. They should not. The MCP server's purpose is the Leland domain, not the import pipeline.
