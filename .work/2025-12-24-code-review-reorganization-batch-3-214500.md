# Code Review: Repository Reorganization Batch 3

**Commits Reviewed:**
- ab5aec6: refactor: update hooks.json paths to use core/
- bc72dab: docs: update CLAUDE.md paths for new structure
- 755ac04: chore: update mise.toml CLI paths for new structure

**Date:** 2025-12-24
**Reviewer:** Claude Code

---

## Status: BLOCKED

**Critical Issue:** CLAUDE.md contains broken documentation links. The referenced files do not exist at the updated locations. ARCHITECTURE.md and SETUP.md have not been updated with the new paths, creating inconsistency in the repository.

---

## BLOCKING (Must Fix Before Merge)

### 1. **Broken Documentation Link References in CLAUDE.md**

**Severity:** BLOCKING - Documentation usability

**Issue:**
Commit bc72dab updated CLAUDE.md to reference documentation files at root level:
```markdown
- [README.md](README.md) - Quick start and examples
- [SETUP.md](SETUP.md) - Configuration guide
- [CONVENTIONS.md](CONVENTIONS.md) - Context file patterns
- [TYPESCRIPT.md](TYPESCRIPT.md) - Custom TypeScript gates
```

These files **DO exist at the root level** (/Users/tobyhede/psrc/turboshovel/{README,SETUP,CONVENTIONS,TYPESCRIPT}.md). ✓ This is correct.

However, **ARCHITECTURE.md still references outdated paths** and has not been updated:

**File:** `/Users/tobyhede/psrc/turboshovel/ARCHITECTURE.md` (lines 17, 23, 60, 107-114)

**Current content shows:**
```
│         node ${CLAUDE_PLUGIN_ROOT}/hooks/hooks-app/dist/cli.js          │
│                     plugin/hooks/hooks-app/src/cli.ts                   │
├── hooks-app/              # TypeScript application
"command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/hooks-app/dist/cli.js"
tail -f $(node plugin/hooks/hooks-app/dist/cli.js log-path)
└── hooks/
    ├── hooks.json
    ├── gates.json
    ├── ARCHITECTURE.md         # This file
    ├── CONVENTIONS.md
    ├── README.md
    ├── SETUP.md
    ├── TYPESCRIPT.md
    ├── hooks-app/              # TypeScript application
```

**Required Updates:**
- Line 17: `${CLAUDE_PLUGIN_ROOT}/hooks/hooks-app/dist/cli.js` → `${CLAUDE_PLUGIN_ROOT}/core/dist/cli.js`
- Line 23: `plugin/hooks/hooks-app/src/cli.ts` → `plugin/core/src/cli.ts`
- Lines 107-114: Directory structure diagram shows old `hooks/` structure with nested `hooks-app/` - must be flattened to reflect `plugin/core/`
- Line 107: Remove references to `plugin/hooks/` - should show `plugin/core/` as the application directory

**Why This Blocks Merge:**
- ARCHITECTURE.md is the authoritative documentation for system design and is explicitly referenced in CLAUDE.md
- Readers following these paths will encounter 404 errors or find non-existent commands
- This breaks developer onboarding and troubleshooting workflows

---

### 2. **Inconsistent Path Updates Across Configuration Files**

**Severity:** BLOCKING - Runtime correctness

**Issue:**
Three separate files were updated with path changes:
- `plugin/hooks.json` - All 11 hook entries (ab5aec6) ✓ Correct
- `mise.toml` - 6 CLI path references (755ac04) ✓ Correct
- `CLAUDE.md` - Development commands (bc72dab) ✓ Correct

However, the batch is **incomplete** because **SETUP.md and INTEGRATION_TESTS.md** still contain old paths:

**File:** `/Users/tobyhede/psrc/turboshovel/SETUP.md`
```
node ${CLAUDE_PLUGIN_ROOT}/hooks/hooks-app/dist/cli.js
```

**File:** `/Users/tobyhede/psrc/turboshovel/INTEGRATION_TESTS.md`
```
node ${CLAUDE_PLUGIN_ROOT}/hooks/hooks-app/dist/cli.js
```

**Why This Blocks Merge:**
- Configuration is inconsistent across the codebase
- Users following SETUP.md instructions will encounter path errors
- Integration tests documentation points to non-existent paths
- This creates a false sense of completion while leaving critical documentation broken

---

### 3. **Memory Files Not Updated**

**Severity:** BLOCKING - Knowledge consistency

**File:** `/Users/tobyhede/psrc/turboshovel/.serena/memories/turboshovel_architecture_analysis.md`

**Issue:**
The Serena memory file contains 10+ references to old paths:
```
plugin/hooks/hooks-app/src/config.ts
plugin/hooks/hooks-app/src/dispatcher.ts
plugin/hooks/hooks-app/src/session.ts
plugin/hooks/hooks-app/src/gates/
...
```

**Why This Blocks Merge:**
- This memory is used to guide future agent work on the codebase
- Agents following this memory will attempt to edit files at paths that no longer exist
- Creates maintenance debt and agent confusion

---

## NON-BLOCKING (May Be Deferred)

### 1. **Minor: Directory Structure Diagram Becomes Stale**

**Severity:** NON-BLOCKING - Documentation clarity

The directory structure in ARCHITECTURE.md (lines 100-150) shows:
```
└── hooks/
    ├── hooks-app/              # TypeScript application
```

This should be updated to show:
```
└── core/                       # TypeScript application
```

This is documentation-only and doesn't affect runtime behavior. It can be fixed in a follow-up commit focused on documentation consistency.

---

### 2. **Commit Message Could Be More Descriptive**

**Severity:** NON-BLOCKING - Code maintenance

**ab5aec6:** `refactor: update hooks.json paths to use core/`

**Observation:** The commit message doesn't mention that this is part of a larger batch (batch 3) or that related documentation still needs updating. Adding context like "batch 3 of repository flattening" would improve future git log readability.

**Recommendation:** Not required for merge, but helpful for future archaeology.

---

## Checklist

### Code Quality
- [x] All path replacements in reviewed files are syntactically correct (JSON valid, shell syntax correct)
- [x] Variable substitution is consistent (`${CLAUDE_PLUGIN_ROOT}` used uniformly)
- [x] No typos in path transformations (hooks-app → core)
- [ ] **INCOMPLETE:** Documentation and supporting files fully updated across batch
- [ ] **INCOMPLETE:** Memory files updated to reflect new structure

### Functionality
- [x] Hook registration paths point to correct compiled CLI output
- [x] mise.toml tasks correctly reference new CLI paths
- [x] CLAUDE.md development commands use correct directory
- [ ] **BROKEN:** ARCHITECTURE.md contains outdated path references
- [ ] **BROKEN:** SETUP.md contains outdated CLI path references
- [ ] **BROKEN:** INTEGRATION_TESTS.md contains outdated CLI path references

### Testing & Verification
- [x] Reviewed files exist and are readable
- [x] New paths (plugin/core/dist/cli.js) exist in filesystem
- [x] Root documentation files exist at referenced locations
- [ ] **NOT DONE:** End-to-end verification that hooks execute with new paths

### Documentation
- [ ] **INCOMPLETE:** All path references updated consistently across codebase
- [ ] **INCOMPLETE:** Documentation links not broken
- [ ] **INCOMPLETE:** Memory files synchronized with code changes

### Maintainability
- [ ] **INCOMPLETE:** Related documentation updated as part of same batch
- [ ] **INCOMPLETE:** No references to old paths remain in documentation

---

## Recommendations

### Before Merging
1. **Update ARCHITECTURE.md** - Replace all instances of `hooks/hooks-app` with `core` (lines 17, 23, 60, 99-150)
2. **Update SETUP.md** - Replace CLI path references to use `core/dist/cli.js`
3. **Update INTEGRATION_TESTS.md** - Replace CLI path references to use `core/dist/cli.js`
4. **Update memory file** - Either delete `.serena/memories/turboshovel_architecture_analysis.md` or update all 10+ path references

### Verification Commands
```bash
# Search for remaining old paths
grep -r "hooks/hooks-app" /Users/tobyhede/psrc/turboshovel --include="*.md" --include="*.json" --include="*.toml" --exclude-dir=node_modules --exclude-dir=.git

# Verify all files exist at new paths
ls -la /Users/tobyhede/psrc/turboshovel/plugin/core/dist/cli.js
```

---

## Summary

**Three commits with good structure, but batch is incomplete.** The core path updates (hooks.json, mise.toml, CLAUDE.md) are correct and consistent. However, several documentation and configuration files were missed:

- ARCHITECTURE.md: 4+ outdated path references
- SETUP.md: 1+ outdated CLI paths
- INTEGRATION_TESTS.md: 1+ outdated CLI paths
- Memory files: 10+ outdated references

This creates an inconsistent state where some documentation is updated and other parts are stale. Developers following SETUP.md will encounter broken paths. Agents using the memory file will attempt to edit non-existent files.

**Recommendation:** BLOCK merge until all references are updated. The fix is straightforward (search-and-replace across 3 files + 1 memory update).
