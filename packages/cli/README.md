# @turboshovel/cli

Quality gates CLI for turboshovel.

## Installation

```bash
npm install -g @turboshovel/cli
```

## Usage

Run quality gates defined in your project's `.claude/turboshovel.json` configuration:

```bash
turboshovel gate <name>
```

The gate name must match a gate defined in the `gates` section of your turboshovel configuration.

## Example

Given this configuration in `.claude/turboshovel.json`:

```json
{
  "gates": {
    "check": {
      "description": "Run project quality checks",
      "command": "npm run lint"
    }
  }
}
```

Run the gate:

```bash
turboshovel gate check
```

Exit codes:
- `0` - Gate passed
- `1` - Gate failed or not found

## Workflow Orchestration

For workflow orchestration functionality (running multi-step processes), use the separate `@rundown/cli` package:

```bash
npm install -g @rundown/cli
```

See the [Rundown System](../../CLAUDE.md#rundown-system) section in the main documentation for workflow commands.

## License

MIT
