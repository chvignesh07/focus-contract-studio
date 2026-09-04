# Contributing to Focus Contract Studio

Thank you for improving Focus Contract Studio. This repository accepts focused,
evidence-backed changes that preserve the product's human-authority boundary.

## Before you start

Read these in order:

1. [Product truth](docs/authority/PRODUCT_TRUTH.md)
2. [WebMCP tool contract](docs/contracts/WEBMCP_TOOL_CONTRACT.md)
3. [Architecture](docs/architecture/ARCHITECTURE.md)
4. [Test strategy](docs/quality/TEST_STRATEGY.md)

The [documentation index](docs/README.md) routes to deeper material. Report
security problems through [SECURITY.md](SECURITY.md), not a public issue.

## Non-negotiable product invariants

- Evidence may inform a proposal; it never approves or authorizes a mutation.
- The page registers exactly four `fcs-webmcp-v2` tools.
- There is no approval tool. Approval is an exact visible UI action.
- Create never applies; apply never approves; verify never manufactures events.
- Workspace identity is server-resolved, not caller-selected.
- The complete human workflow remains usable without WebMCP.
- Tests and documentation must not contain credentials, personal data, or
  unredacted local machine paths.

If a proposed feature conflicts with one of these rules, open a design issue
before writing code.

## Local workflow

Use exact Node.js `22.22.3` and npm `10.9.8`.

```sh
npm ci
npm run setup:browsers
cp .env.example .env.local
```

Generate three distinct secrets with the command in the
[local setup guide](README.md#start-the-interactive-app), paste them into
`.env.local`, and run:

```sh
npm run dev
```

Never commit `.env.local` or working credentials.

## Make the smallest complete change

1. Branch from current `main`.
2. Reproduce a defect before fixing it, or write the acceptance condition for a
   documentation change.
3. Reuse existing contracts, operations, test helpers, and scripts.
4. Add the smallest regression check that would fail if the behavior returned.
5. Run focused checks while working, then the canonical gate before review.
6. Update product, security, operations, and evidence documentation when their
   truth changes.

Useful focused commands:

```sh
npm run typecheck
npm run lint
npm run test:package7:node:core
npm run test:package8:browser
npm run build
```

The complete gate is:

```sh
npm run verify
```

It requires Gitleaks `8.30.1` and the project-local Playwright browser installed
by `npm run setup:browsers`.

## Pull-request checklist

- [ ] The change has one clear problem statement and acceptance condition.
- [ ] The four-tool and visible-approval boundaries are unchanged or explicitly
      reviewed against the product authority.
- [ ] New or changed behavior has a regression check.
- [ ] `npm run verify` passes on the exact proposed commit.
- [ ] UI work was checked with keyboard input and relevant narrow/responsive
      states.
- [ ] Public text distinguishes verified facts from local-only or pending work.
- [ ] No secret, personal data, machine-local path, or unlicensed asset was added.
- [ ] Documentation and provenance are current.

By participating, you agree to follow the
[Code of Conduct](CODE_OF_CONDUCT.md). Contributions are accepted under the
repository's [Apache License 2.0](LICENSE).
