# Security Policy

Focus Contract Studio is a public hackathon demonstration with a deliberately
narrow data and authority model. It is not a production-security certification.

## Supported versions

Security fixes target the current `main` branch and the latest annotated public
release. Historical package checkpoints are retained as evidence and are not
maintained as separate supported products.

## Report a vulnerability privately

This branch must not be published until GitHub private vulnerability reporting
is enabled and verified for the repository. Once enabled, use
[Report a vulnerability](https://github.com/chvignesh07/focus-contract-studio/security/advisories/new).
Do not open a public issue or send a social-media message with exploit details,
credentials, tokens, personal data, or an unredacted trace.

Include:

- the affected commit, tag, route, or WebMCP tool;
- impact and the authority or data boundary involved;
- minimal local reproduction steps using synthetic data;
- relevant request/response metadata with all secrets and identifiers redacted;
- any suggested mitigation.

We aim to acknowledge a complete report within three business days, triage it
within seven business days, and provide an update at least every fourteen days
until resolution. These are response targets, not a service-level agreement.

## Safe testing boundary

Test only a local clone with synthetic data. Do not probe the public deployment,
attempt denial of service, access another person's workspace, bypass platform
controls, submit real personal or regulated data, or retain data that is not
yours. Stop and report if you encounter unexpected access.

## Security model

The most important invariants are:

- WebMCP cannot approve a proposal;
- caller input cannot choose session or workspace identity;
- strict schemas, same-origin checks, revision guards, idempotency, bounded
  admission, and atomic D1 writes fail closed;
- browser observation captures allowlisted focus events, not typed values or
  arbitrary page content;
- secrets belong only in ignored local environment files or the deployment
  platform's secret store.

Read the complete [security and privacy contract](docs/quality/SECURITY_AND_PRIVACY.md)
and [deployment runbook](docs/delivery/DEPLOYMENT_AND_OPERATIONS.md) before
changing a trust boundary.
