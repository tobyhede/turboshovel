# Research Findings - TypeScript CLI Libraries (December 2025)

## Metadata
- Date: 2025-12-23 10:45:00
- Topic: Canonical best practices for creating CLI tools with TypeScript
- Researcher: Agent A (Dual-Verification)
- Angles Explored:
  1. Library ecosystem analysis (maturity, features, TypeScript support)
  2. Health metrics (GitHub activity, npm downloads, maintenance)
  3. Community recommendations and major project usage
  4. TypeScript-first design considerations

---

## Executive Summary

For a **complicated CLI tool** with subcommands, state management, and robust argument parsing in TypeScript, the landscape offers clear tiers:

| Tier | Libraries | Best For |
|------|-----------|----------|
| **Production-Ready Mainstream** | Commander.js, Yargs | Broad ecosystem, proven stability |
| **TypeScript-First Enterprise** | Oclif, Stricli | Full type safety, plugin systems |
| **Modern Lightweight** | CAC, Citty | Simple APIs, Vite/Nuxt ecosystem |
| **Type-Safe Specialized** | Clipanion | Yarn-style complex CLIs |

---

## Findings by Library

### 1. Commander.js

**Finding:** Commander.js is the most widely-used CLI library with ~238M weekly npm downloads, but has fundamental TypeScript limitations due to method chaining architecture.

- **Source:** [npm-trends comparison](https://npmtrends.com/commander-vs-oclif-vs-yargs)
- **Confidence:** HIGH
- **Evidence:** "Commander.js was eliminated from consideration [by Bloomberg] because it relies on method chaining, which...is almost impossible to use static typing end-to-end" - [Stricli Alternatives](https://bloomberg.github.io/stricli/docs/getting-started/alternatives)

**Finding:** Commander.js offers enhanced TypeScript support via `@commander-js/extra-typings` package, but requires TypeScript 5.0+ and has ergonomic limitations.

- **Source:** [GitHub - commander-js/extra-typings](https://github.com/commander-js/extra-typings)
- **Confidence:** HIGH
- **Evidence:** "The generics lead to some noisy types visible in editor and errors" and requires chaining options at declaration time for type inference to work.

**Finding:** Commander.js is actively maintained with v14.0.2 (December 2025), requiring Node.js 20+.

- **Source:** [Commander.js Releases](https://github.com/tj/commander.js/releases)
- **Confidence:** HIGH
- **Evidence:** 27.8k GitHub stars, 13-15 open issues, regular releases every 1-2 months.

**Health Metrics:**
| Metric | Value |
|--------|-------|
| GitHub Stars | 27,810 |
| Weekly Downloads | ~238M |
| Open Issues | 13-15 |
| TypeScript | Bundled types + @commander-js/extra-typings |
| Last Release | v14.0.2 (December 2025) |
| Node.js Requirement | v20+ |

---

### 2. Yargs

**Finding:** Yargs is the second most popular CLI library (~126-138M weekly downloads) with comprehensive feature set but requires external `@types/yargs` for TypeScript.

- **Source:** [npm-trends comparison](https://npmtrends.com/commander-vs-oclif-vs-yargs)
- **Confidence:** HIGH
- **Evidence:** Latest version v18.0.0 released May 27, 2025. 11.4k GitHub stars with 292 open issues.

**Finding:** Yargs TypeScript experience is described as requiring "plugins and manual configuration" with API that is "not as type-safe as Stricli."

- **Source:** [Stricli Alternatives](https://bloomberg.github.io/stricli/docs/getting-started/alternatives)
- **Confidence:** MEDIUM
- **Evidence:** This is Bloomberg's assessment; community experience may vary.

**Finding:** Yargs has substantial dependent ecosystem with 29.2M+ dependent projects and 40,842 npm packages depending on it.

- **Source:** [yargs npm page](https://www.npmjs.com/package/yargs)
- **Confidence:** HIGH
- **Evidence:** Direct npm registry data.

**Health Metrics:**
| Metric | Value |
|--------|-------|
| GitHub Stars | 11,410 |
| Weekly Downloads | ~126-138M |
| Open Issues | 292-304 |
| TypeScript | @types/yargs (external) |
| Last Release | v18.0.0 (May 2025) |

---

### 3. Oclif (Salesforce/Heroku)

**Finding:** Oclif is a full CLI framework (not just parser) with first-class TypeScript support, plugin architecture, and enterprise backing from Salesforce.

- **Source:** [Oclif Spring 2024 Update](https://oclif.io/blog/2024/03/29/spring-update/)
- **Confidence:** HIGH
- **Evidence:** Repository is 94.4% TypeScript. v4.22.59 released December 21, 2025.

**Finding:** Oclif v4 (June 2024) brought significant improvements: full ESM support, Bun/tsx runtime support, configurable command discovery, and enhanced flag types.

- **Source:** [Oclif Spring 2024 Update](https://oclif.io/blog/2024/03/29/spring-update/)
- **Confidence:** HIGH
- **Evidence:** Direct from oclif blog documentation.

**Finding:** Oclif has lower adoption numbers (~173-178K weekly downloads) but is designed for complex, enterprise-grade CLIs with plugin ecosystems.

- **Source:** [npm-trends comparison](https://npmtrends.com/commander-vs-oclif-vs-yargs)
- **Confidence:** HIGH
- **Evidence:** 9.4k GitHub stars, only 10-11 open issues (excellent issue management).

**Health Metrics:**
| Metric | Value |
|--------|-------|
| GitHub Stars | 9,383 |
| Weekly Downloads | ~173-178K |
| Open Issues | 10-11 |
| TypeScript | Native (94.4% TS) |
| Last Release | v4.22.59 (December 21, 2025) |
| Backing | Salesforce |

---

### 4. Stricli (Bloomberg)

**Finding:** Stricli is a new TypeScript-first CLI framework from Bloomberg (October 2024) with zero runtime dependencies and full type inference.

- **Source:** [Stricli Introduction](https://bloomberg.github.io/stricli/blog/intro)
- **Confidence:** HIGH
- **Evidence:** v1.2.4 released October 14, 2025. Repository is 99.2% TypeScript.

**Finding:** Stricli was created because Bloomberg found existing options (Commander, Yargs, Oclif, Clipanion) inadequate for their type safety requirements.

- **Source:** [Stricli Alternatives Comparison](https://bloomberg.github.io/stricli/docs/getting-started/alternatives)
- **Confidence:** HIGH
- **Evidence:** Direct documentation states: "As a company that supports and encourages TypeScript development, full type support was a critical requirement."

**Finding:** Stricli features unique lazy module loading via ES import() syntax for performance, and runtime-based autocomplete (not shell-specific).

- **Source:** [Stricli Overview](https://bloomberg.github.io/stricli/docs/getting-started/overview)
- **Confidence:** HIGH
- **Evidence:** Direct documentation.

**Health Metrics:**
| Metric | Value |
|--------|-------|
| GitHub Stars | 970 |
| Weekly Downloads | (Lower - newer library) |
| Open Issues | 15 |
| TypeScript | Native (99.2% TS) |
| Last Release | v1.2.4 (October 2025) |
| Backing | Bloomberg |

---

### 5. CAC (Command And Conquer)

**Finding:** CAC is a lightweight, zero-dependency CLI library written in TypeScript, used by Vite and Vitest.

- **Source:** [CAC GitHub](https://github.com/cacjs/cac)
- **Confidence:** HIGH
- **Evidence:** ~15.6M weekly downloads. Used as dependency in Vite (13M weekly downloads) and Vitest (7.7M weekly downloads).

**Finding:** CAC has minimal API surface (4 main APIs: `cli.option`, `cli.version`, `cli.help`, `cli.parse`) making it easy to learn.

- **Source:** [CAC npm](https://www.npmjs.com/package/cac)
- **Confidence:** HIGH
- **Evidence:** Direct from package documentation.

**Finding:** CAC shows limited recent maintenance activity - last commit December 31, 2022.

- **Source:** [CAC GitHub](https://github.com/cacjs/cac)
- **Confidence:** HIGH
- **Evidence:** "Last updated: 3 years ago" per npm-trends. This is a concern for active development.

**Health Metrics:**
| Metric | Value |
|--------|-------|
| GitHub Stars | 2,892 |
| Weekly Downloads | ~15.6M |
| Open Issues | 27 |
| TypeScript | Native |
| Last Release | v6.7.14 (December 2022) |
| Used By | Vite, Vitest |

---

### 6. Citty (UnJS)

**Finding:** Citty is an elegant CLI builder from UnJS ecosystem, used by Nuxt CLI (nuxi) since v3.7.

- **Source:** [Nuxt 3.7 Blog](https://nuxt.com/blog/v3-7)
- **Confidence:** HIGH
- **Evidence:** "Nuxt refactored nuxi using unjs/citty...allows for making CLI capabilities extendable."

**Finding:** Citty has strong TypeScript support (99.6% TS) with `defineCommand` type helper for full inference.

- **Source:** [Citty GitHub](https://github.com/unjs/citty)
- **Confidence:** HIGH
- **Evidence:** Direct repository analysis.

**Finding:** Citty shows moderate maintenance - last release v0.1.6 on February 14, 2024, with 42 open issues.

- **Source:** [Citty GitHub](https://github.com/unjs/citty)
- **Confidence:** HIGH
- **Evidence:** Still in 0.x versioning, indicating API may not be stable.

**Health Metrics:**
| Metric | Value |
|--------|-------|
| GitHub Stars | 1,000-1,026 |
| Weekly Downloads | ~8.2-15.6M |
| Open Issues | 42 |
| TypeScript | Native (99.6% TS) |
| Last Release | v0.1.6 (February 2024) |
| Used By | Nuxt CLI (nuxi) |

---

### 7. Clipanion

**Finding:** Clipanion is a type-safe CLI library with zero runtime dependencies, powering Yarn Modern. Uses class-based command structure with decorators.

- **Source:** [Clipanion GitHub](https://github.com/arcanis/clipanion)
- **Confidence:** HIGH
- **Evidence:** 1.2k GitHub stars, 98.6% TypeScript. Created by Mael Nison (Yarn maintainer).

**Finding:** Clipanion uses a Finite State Machine for command resolution and has excellent TypeScript inference without separate type declarations.

- **Source:** [Clipanion Documentation](http://mael.dev/clipanion/docs/getting-started/)
- **Confidence:** HIGH
- **Evidence:** Direct documentation states "If you use TypeScript, all property types will be properly inferred."

**Finding:** Clipanion has lower weekly downloads (~3.4M) but powers critical infrastructure (Yarn).

- **Source:** [npm-trends cac-vs-citty-vs-clipanion](https://npmtrends.com/cac-vs-citty-vs-clipanion)
- **Confidence:** HIGH
- **Evidence:** Direct npm trends data.

**Health Metrics:**
| Metric | Value |
|--------|-------|
| GitHub Stars | 1,213 |
| Weekly Downloads | ~3.4M |
| Open Issues | 32 |
| TypeScript | Native (98.6% TS) |
| Last Release | v4.0.0-rc.4 |
| Used By | Yarn |

---

## Major Projects Usage

| Project | CLI Library | Notes |
|---------|-------------|-------|
| **Yarn** | Clipanion | Created by same author |
| **Vite** | CAC | Lightweight, minimal |
| **Vitest** | CAC | Follows Vite's choice |
| **Nuxt CLI** | Citty | UnJS ecosystem |
| **Salesforce CLI** | Oclif | Enterprise-grade |
| **Heroku CLI** | Oclif | Original creator |
| **Bloomberg Internal CLIs** | Stricli | Type-safety focus |

---

## Gaps and Unanswered Questions

1. **Long-term viability of CAC**: Despite high downloads (via Vite/Vitest), no commits since December 2022. Is it feature-complete or abandoned?

2. **Citty stability**: Still at v0.1.6 - when will it reach v1.0? Is the API stable enough for production use?

3. **Stricli adoption trajectory**: Only 970 stars after 14 months. Will it gain broader adoption outside Bloomberg?

4. **Performance benchmarks**: No comparative performance data found between libraries for parsing speed or startup time.

5. **Windows compatibility**: Limited information on Windows-specific issues across libraries.

---

## Recommendation

### For the Turboshovel Workflow Tool

**Context Requirements:**
- Robust argument parsing
- Subcommands (start, next, status, stop)
- State management
- Good TypeScript support
- Active maintenance

**Recommended: Commander.js with @commander-js/extra-typings**

**Rationale:**
1. **Maturity**: 27.8k stars, 238M weekly downloads, proven stability
2. **TypeScript**: Extra-typings package provides enhanced inference (acceptable tradeoff)
3. **Subcommands**: Native git-style subcommand support
4. **Maintenance**: Active development, v14.0.2 just released
5. **Ecosystem**: Vast documentation, tutorials, community support
6. **Learning Curve**: Low - widely understood API

**Alternative Recommendation: Oclif**

If the project anticipates:
- Plugin system needs
- Complex command hierarchies
- Enterprise deployment

Oclif provides superior TypeScript integration and scaffolding but with higher complexity.

**Not Recommended for This Use Case:**
- **CAC**: Maintenance concerns (no updates in 3 years)
- **Citty**: Still 0.x, immature for production
- **Stricli**: Newer, smaller ecosystem despite excellent design
- **Clipanion**: Better suited for very complex CLIs like Yarn

---

## Confidence Summary

| Finding Category | Confidence |
|-----------------|------------|
| Download statistics | HIGH |
| GitHub activity metrics | HIGH |
| TypeScript support quality | HIGH |
| Bloomberg's assessment | HIGH |
| Community recommendations | MEDIUM |
| Long-term maintenance predictions | LOW |

---

## Sources

- [npm-trends: Commander vs Oclif vs Yargs](https://npmtrends.com/commander-vs-oclif-vs-yargs)
- [Stricli Documentation](https://bloomberg.github.io/stricli/)
- [Stricli Alternatives Comparison](https://bloomberg.github.io/stricli/docs/getting-started/alternatives)
- [Oclif Spring 2024 Update](https://oclif.io/blog/2024/03/29/spring-update/)
- [Commander.js GitHub](https://github.com/tj/commander.js)
- [Commander.js Extra Typings](https://github.com/commander-js/extra-typings)
- [CAC GitHub](https://github.com/cacjs/cac)
- [Citty GitHub](https://github.com/unjs/citty)
- [Clipanion GitHub](https://github.com/arcanis/clipanion)
- [Nuxt 3.7 Blog](https://nuxt.com/blog/v3-7)
- [LogRocket: Building TypeScript CLI with Commander](https://blog.logrocket.com/building-typescript-cli-node-js-commander/)
- [Bytes Newsletter #328](https://bytes.dev/archives/328)

---

STATUS: COMPLETE
