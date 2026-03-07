# Knowledge Base Governance Plan

## Goal

This plan defines how the project should prepare, classify, and import customer-service documents into FastGPT for production use.

The immediate target is to avoid three common production failures:

1. old and new versions answering at the same time
2. internal or sensitive operations content leaking into general support answers
3. unrelated products being retrieved in the same conversation

## Recommended Production Structure

### Layer 1: Global Policy Library

Use this library for knowledge that is shared across products.

- service hotlines
- escalation rules
- refund and compensation principles
- common service terminology
- standard answer templates

### Layer 2: Product Customer-Service Libraries

Use one library per product or per stable product family.

- passenger flow analytics
- license plate recognition
- intrusion detection
- video AI algorithm cabin

Rules:

- only keep the current effective version in the production library
- archive historical versions outside the default retrieval path
- route product questions to the matching product library first

### Layer 3: Device and Marketplace Libraries

Use separate libraries for device model documentation and marketplace goods.

- camera model manuals
- marketplace goods support docs
- model compatibility notes

Rules:

- do not mix device-model documents with product-policy documents
- keep device compatibility information close to the device or SKU scope

### Layer 4: Internal Support Libraries

Use restricted libraries for internal-only operations content.

- default credentials
- private IP addresses
- SSH access
- deployment and maintenance steps
- troubleshooting scripts

Rules:

- never expose this layer to ordinary customer-service agents
- never include this layer in public or broad support workflows
- require explicit role-based access

## Security Classification

Each file should be assigned one initial security level before import.

- `PUBLIC_CS`: safe for ordinary customer-service Q&A
- `INTERNAL_SUPPORT`: internal support knowledge, not for general agents
- `RESTRICTED`: contains secrets, default credentials, private addresses, or infrastructure details

If a single document contains both customer-service content and restricted content, split it into two derived documents before import.

## Metadata Requirements

Each imported document should carry these fields in the project metadata table:

- `source_dir`
- `file_name`
- `product_line`
- `product_name`
- `document_type`
- `channel`
- `region`
- `effective_date`
- `version`
- `version_rank`
- `is_latest`
- `security_level`
- `audience_scope`
- `import_scope`
- `status`
- `notes`

Recommended values:

- `audience_scope`: `CS_AGENT`, `INTERNAL_SUPPORT`, `RESTRICTED`
- `import_scope`: `GLOBAL`, `PRODUCT`, `DEVICE`, `INTERNAL`
- `status`: `CANDIDATE`, `APPROVED`, `ARCHIVED`, `BLOCKED`

## Import Rules

### Version Governance

- import only one active version per product document into the production retrieval path
- mark older versions as archived
- if the latest version is unclear, block import until confirmed

### Content Splitting

Split documents by heading-level business meaning, not only by fixed character count.

Good chunk boundaries:

- product introduction
- pricing
- subscription rules
- cancellation and refund rules
- usage instructions
- device compatibility
- FAQ

Avoid combining multiple business intents in the same chunk when the document already has clear section headings.

### Sensitive Content Handling

Before import, scan for:

- private IP ranges
- default usernames and passwords
- SSH references
- admin portal addresses
- phrases such as "internal use only"

If matched:

- mark the file `RESTRICTED`
- do not import it into the ordinary support library
- either redact it or create an internal-only copy

## Routing Strategy

Production routing should prefer deterministic scope over broad retrieval.

1. detect intent and product
2. query the matching product or device library
3. optionally query the global policy library
4. merge and generate the final structured answer
5. if the answer requires implementation-only knowledge, escalate to internal support instead of exposing restricted content

## FastGPT Mapping

Recommended FastGPT application layout:

1. one global support application
2. one product-support application template
3. one internal-support application

Recommended dataset layout:

1. one dataset for global policy
2. one dataset per product or product family
3. one dataset per device family when device questions are common
4. one or more restricted internal datasets

Do not rely on prompt-only scope control for single-document or sensitive-content isolation.

## Suggested Operating Process

1. scan incoming directories and build an inventory
2. extract product, version, date, and channel from file names
3. detect sensitive content from raw text
4. identify latest version per product key
5. manually review blocked or ambiguous files
6. split or redact mixed-scope documents
7. import approved files to the target dataset
8. record import results and FastGPT collection identifiers

## Immediate Use In This Repo

This repository now includes a directory scanning script intended to generate:

- JSON inventory
- CSV inventory
- duplicate version groups
- sensitive-file candidates

Use that inventory as the source of truth before importing new document batches.
