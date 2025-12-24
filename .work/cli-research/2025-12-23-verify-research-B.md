# Research Findings - TypeScript CLI Libraries (December 2025)

## Metadata

- **Date:** 2025-12-23 14:32:00
- **Topic:** Canonical best way to create CLI tools with TypeScript
- **Research Context:** Workflow tool with subcommands, state management, argument parsing
- **Angles Explored:**
  - Library ecosystem analysis (7 libraries evaluated)
  - Health metrics (GitHub activity, npm downloads, maintenance)
  - Community recommendations and major project usage
  - TypeScript-first design considerations

---

## Findings by Category

### 1. Library Ecosystem Analysis

#### Commander.js

**Finding:** Commander.js is the most widely-used CLI library with massive adoption but was not designed with TypeScript type inference in mind.

- **Source:** [npm-compare.com](https://npm-compare.com/commander,oclif,vorpal,yargs), [GitHub](https://github.com/tj/commander.js)
- **Confidence:** HIGH
- **Evidence:**
  - 27,800 GitHub stars
  - 237+ million weekly npm downloads
  - 104,561 dependent packages
  - 13 open issues (excellent maintenance)
  - Created August 2011, actively maintained
  - Current version: 14.0.2
  - Requires Node.js 20+

**TypeScript Support:**
- **Finding:** Commander.js requires `@commander-js/extra-typings` package for strong type inference.
- **Source:** [GitHub extra-typings](https://github.com/commander-js/extra-typings)
- **Confidence:** HIGH
- **Evidence:** "The runtime is supplied by commander. This package is all about the typings." Requires TypeScript 5.0+, method chaining required for type inference to work.

---

#### Yargs

**Finding:** Yargs is feature-rich with strong argument parsing but has weaker native TypeScript support and more dependencies.

- **Source:** [GitHub](https://github.com/yargs/yargs), [npmtrends](https://npmtrends.com/commander-vs-oclif-vs-yargs)
- **Confidence:** HIGH
- **Evidence:**
  - 11,400 GitHub stars
  - 126+ million weekly npm downloads
  - 292 open issues (higher issue count)
  - 285 contributors
  - Created November 2013
  - Current version: v18.0.0 (May 27, 2025)

**TypeScript Support:**
- **Finding:** Yargs types via `@types/yargs` provide good inference but require manual configuration.
- **Source:** [Stricli alternatives page](https://bloomberg.github.io/stricli/docs/getting-started/alternatives)
- **Confidence:** MEDIUM
- **Evidence:** "It requires installing plugins and manual configuration to get TypeScript support, and the API is not as type-safe."

---

#### Oclif (Salesforce)

**Finding:** Oclif is an enterprise-grade framework with first-class TypeScript support, plugin architecture, and active Salesforce backing.

- **Source:** [GitHub](https://github.com/oclif/oclif), [oclif.io](https://oclif.io/)
- **Confidence:** HIGH
- **Evidence:**
  - 9,400 GitHub stars
  - 178,000 weekly npm downloads
  - 729 total releases (very actively maintained)
  - 83 contributors
  - Created January 2018
  - Latest version: 4.22.59 (December 21, 2025)
  - Only 10 open issues (excellent maintenance)

**Major Users:**
- **Finding:** Oclif powers Heroku CLI, Salesforce CLI, Twilio CLI, and Shopify CLI.
- **Source:** [Heroku Blog](https://www.heroku.com/blog/heroku-cli-v9-infrastructure-upgrades-oclif-transition/)
- **Confidence:** HIGH
- **Evidence:** "Heroku CLI v9.0.0 focuses on architectural improvements, with all core CLI commands built on the oclif platform."

**Consideration:**
- **Finding:** Oclif may be overkill for smaller CLI apps.
- **Source:** [blog.kilpatrick.cloud](https://blog.kilpatrick.cloud/posts/node-cli-app-packages/)
- **Confidence:** MEDIUM
- **Evidence:** "For giant CLI apps with lots of git-style subcommands, oclif is a standout choice. For smaller CLI apps, it may be overkill."

---

#### Citty (UnJS)

**Finding:** Citty is a modern, lightweight TypeScript-first CLI builder from the UnJS ecosystem with elegant API design.

- **Source:** [GitHub](https://github.com/unjs/citty), [unjs.io](https://unjs.io/packages/citty/)
- **Confidence:** HIGH
- **Evidence:**
  - 1,000 GitHub stars
  - 8.2 million weekly npm downloads
  - 42 open issues
  - 19 contributors
  - Created March 2023
  - Current version: v0.1.6 (February 2024)
  - Still pre-1.0, described as "under heavy development"

**Concern:**
- **Finding:** Citty is still in v0.x and not yet stable.
- **Source:** [GitHub releases](https://github.com/unjs/citty/releases)
- **Confidence:** HIGH
- **Evidence:** Current version is 0.1.6 with no v1.0 release yet. Repository notes it is "under heavy development."

---

#### CAC (Command And Conquer)

**Finding:** CAC is a lightweight, zero-dependency CLI library written in TypeScript, used by Vite.

- **Source:** [GitHub](https://github.com/cacjs/cac), [npm](https://www.npmjs.com/package/cac)
- **Confidence:** HIGH
- **Evidence:**
  - 2,900 GitHub stars
  - 15.6 million weekly npm downloads
  - 27 open issues
  - Created January 2016
  - Current version: 6.7.14
  - Zero dependencies

**Major User:**
- **Finding:** Vite uses CAC for its CLI argument parsing.
- **Source:** [GitHub vitejs/vite](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/cli.ts)
- **Confidence:** HIGH
- **Evidence:** Vite source code shows `import { cac } from 'cac'` and `const cli = cac('vite')`.

---

#### Clipanion

**Finding:** Clipanion is a type-safe, zero-dependency CLI library using a class-based approach, powering Yarn Modern.

- **Source:** [GitHub](https://github.com/arcanis/clipanion), [mael.dev/clipanion](http://mael.dev/clipanion/)
- **Confidence:** HIGH
- **Evidence:**
  - 1,200 GitHub stars
  - 3.4 million weekly npm downloads
  - 32 open issues
  - 27 contributors
  - Created April 2017
  - Version 4.0.0-rc.4 (still in RC phase)
  - Requires TypeScript experimental decorators

**Major User:**
- **Finding:** Yarn Berry (v2+) uses Clipanion for command parsing.
- **Source:** [yarnpkg/berry](https://github.com/yarnpkg/berry)
- **Confidence:** HIGH
- **Evidence:** "Yarn uses the Clipanion library for command parsing and dispatching, with each plugin registering its commands in the central registry."

**Concern:**
- **Finding:** Clipanion requires experimental TypeScript decorators.
- **Source:** [Clipanion README](https://github.com/arcanis/clipanion/blob/master/README.md)
- **Confidence:** HIGH
- **Evidence:** "This syntax assumes you have some way to compile decorators. TypeScript supports them via the experimentalDecorators setting."

---

#### Stricli (Bloomberg)

**Finding:** Stricli is a new TypeScript-first CLI framework from Bloomberg with zero dependencies and lazy loading support.

- **Source:** [GitHub](https://github.com/bloomberg/stricli), [bloomberg.github.io/stricli](https://bloomberg.github.io/stricli/)
- **Confidence:** HIGH
- **Evidence:**
  - 970 GitHub stars
  - 8 weekly npm downloads (very new)
  - 15 open issues
  - 8 contributors
  - Created September 2024 (3 months old)
  - Current version: v1.2.4 (October 2025)
  - Zero runtime dependencies

**Key Differentiator:**
- **Finding:** Stricli supports async lazy module loading for performance.
- **Source:** [Stricli Intro](https://bloomberg.github.io/stricli/blog/intro)
- **Confidence:** HIGH
- **Evidence:** "Using the ECMAScript import() syntax, Stricli directly supports asynchronous lazy module loading. The entire tree of commands can be loaded without importing any application-specific runtime dependencies."

**Concern:**
- **Finding:** Stricli is very new with minimal adoption.
- **Source:** [npm trends](https://npmtrends.com/cac-vs-citty-vs-clipanion-vs-stricli)
- **Confidence:** HIGH
- **Evidence:** Only 8 weekly npm downloads, 226 known dependents, launched October 2024.

---

### 2. Health Metrics Summary

| Library | Stars | Weekly Downloads | Open Issues | Node.js Req | TS Native |
|---------|-------|------------------|-------------|-------------|-----------|
| Commander.js | 27.8k | 237M | 13 | v20+ | No (extra-typings) |
| Yargs | 11.4k | 126M | 292 | varies | No (@types) |
| Oclif | 9.4k | 178k | 10 | v18+ | Yes |
| CAC | 2.9k | 15.6M | 27 | varies | Yes |
| Citty | 1k | 8.2M | 42 | varies | Yes |
| Clipanion | 1.2k | 3.4M | 32 | varies | Yes (decorators) |
| Stricli | 970 | 8 | 15 | v20+ | Yes |

---

### 3. TypeScript-First Design Analysis

**Finding:** Libraries written in TypeScript natively with strong type inference:

1. **Oclif** - First-class TypeScript, class-based commands
2. **CAC** - Written in TypeScript, simple API
3. **Citty** - TypeScript-first, modern design
4. **Clipanion** - Full TypeScript, requires decorators
5. **Stricli** - Designed specifically for TypeScript type flow

**Source:** Multiple GitHub READMEs
**Confidence:** HIGH

---

### 4. Community and Production Usage

**Finding:** Major CLI tools and their library choices:

| Project | Library | Source |
|---------|---------|--------|
| Heroku CLI | Oclif | [Heroku Blog](https://www.heroku.com/blog/heroku-cli-v9-infrastructure-upgrades-oclif-transition/) |
| Salesforce CLI | Oclif | [Salesforce Engineering](https://engineering.salesforce.com/open-sourcing-oclif-the-cli-framework-that-powers-our-clis-21fbda99d33a/) |
| Vite | CAC | [vite/src/node/cli.ts](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/cli.ts) |
| Yarn Berry | Clipanion | [yarnpkg/berry](https://github.com/yarnpkg/berry) |
| Nuxt | Citty | [UnJS ecosystem](https://unjs.io/) |
| Bloomberg internal | Stricli | [Stricli Intro](https://bloomberg.github.io/stricli/blog/intro) |

**Confidence:** HIGH

---

## Gaps and Unanswered Questions

1. **Performance benchmarks:** No direct performance comparison data found for CLI parsing speed across libraries.

2. **Long-term maintenance commitment:** Unclear long-term support plans for Citty (v0.x), Clipanion (RC), and Stricli (very new).

3. **Breaking changes history:** Did not find comprehensive changelogs comparing breaking change frequency.

4. **Testing integration:** Limited data on built-in testing support beyond Oclif.

5. **Error handling patterns:** No detailed comparison of error handling approaches.

6. **Reddit/community sentiment:** Direct Reddit discussion threads were not accessible in search results.

---

## Recommendation for Turboshovel Workflow Tool

### Context Requirements Matched

The workflow tool needs:
- Robust argument parsing
- Subcommands (start, next, status, stop)
- State management
- Good TypeScript support
- Active maintenance

### Recommended: **Commander.js with @commander-js/extra-typings**

**Rationale:**

1. **Maturity and Stability:** 13+ years of production use, 104k+ dependent packages
2. **Active Maintenance:** Only 13 open issues, regular releases
3. **TypeScript Support:** Strong type inference via extra-typings package
4. **Subcommand Support:** Built-in subcommand handling
5. **Documentation:** Extensive documentation and community resources
6. **Low Risk:** Proven track record, unlikely to have breaking changes

**Source:** [Commander.js GitHub](https://github.com/tj/commander.js), [extra-typings](https://github.com/commander-js/extra-typings)
**Confidence:** HIGH

### Alternative: **Oclif**

If the workflow tool grows significantly or needs plugin architecture, Oclif provides:
- Enterprise-grade features
- First-class TypeScript without additional packages
- Plugin system for extensibility
- Salesforce backing

**Source:** [oclif.io](https://oclif.io/)
**Confidence:** HIGH

### Not Recommended for This Use Case:

- **Citty:** Still v0.x, "under heavy development"
- **Stricli:** Too new (3 months old), minimal adoption
- **Clipanion:** Requires experimental decorators, class-based may be overkill
- **CAC:** Good for simple CLIs but less structured for complex subcommand workflows

---

## Summary

For a TypeScript CLI tool with subcommands and state management in December 2025:

1. **Commander.js + extra-typings** is the safest, most mature choice with excellent TypeScript support
2. **Oclif** is the best choice for enterprise/complex CLIs with native TypeScript
3. **CAC** is good for lightweight tools (used by Vite)
4. **Stricli** shows promise but needs time to mature
5. **Citty** is elegant but not yet stable

The CLI library landscape in 2025 has matured significantly, with TypeScript support being a key differentiator. Commander.js remains dominant by adoption, while Oclif leads in TypeScript-native design for complex applications.

---

**STATUS: COMPLETE**

**Report saved to:** `/Users/tobyhede/psrc/turboshovel/.work/2025-12-23-verify-research-B.md`
