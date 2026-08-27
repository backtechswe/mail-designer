# Contributing

```bash
npm install
npm run build     # tsc, then copy the CSS and add "use client" where it belongs
npm test          # builds first, then node --test against dist/
npm run dev       # the playground, at localhost:7788
```

`npm run cli` needs `npm run build` first: the CLI imports from `dist/`, which is not checked
in.

## Things worth knowing before the first pull request

**Tests run against `dist/`, in plain JavaScript.** There is no test framework and no jsdom —
`node --test` and `assert`. Everything testable without a browser is a pure function for that
reason, and if you find yourself unable to test something, that is usually the design telling
you to pull the logic out of the component.

**Golden files.** `test/golden/` holds the renderer's actual output. Update them with:

```bash
UPDATE_GOLDEN=1 npm test
```

Then **read the diff as HTML**. Those files are the only thing standing between us and quietly
removing an Outlook workaround that took an afternoon to find. A golden diff in a pull request
needs a sentence saying what changed and why.

**Email HTML is not HTML.** `docs/email-compatibility.md` is the list of workarounds and what
each one is for. If you are changing anything under `src/render/`, read it first — several
lines that look redundant are load-bearing in exactly one client.

**Real sends beat every test.** No amount of static analysis substitutes for the mail arriving
in Gmail, Apple Mail, Outlook for Windows and Outlook.com. Anything that changes the emitted
HTML meaningfully should be checked that way before it lands.

**Icons.** `src/editor/icons.tsx` is generated. Add a name to `scripts/build-icons.mjs` and run
`npm run icons`; the generator refuses Pro-only glyphs, which may not be redistributed.

## How a change lands

`main` is protected: everything arrives through a pull request that CI has passed on Node
20/22/24, on Linux and Windows. That applies to the maintainer too — the branch rule is there
to stop a hurried direct push as much as anything else.

CI runs on pull requests from forks with a read-only token and no access to repository secrets,
which is the `pull_request` trigger doing its job. Releases run from `workflow_dispatch` only,
so the npm token is reachable from one place and by one person.

## Commits and licence

Sign off your commits (`git commit -s`) to certify the
[Developer Certificate of Origin](https://developercertificate.org/). Contributions are under
the MIT licence in `LICENSE`.
