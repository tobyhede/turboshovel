# User Prompt Context

This context can auto-inject when users submit prompts (UserPromptSubmit hook).

## Keyword-Triggered Gates

Gates configured for UserPromptSubmit can use keywords to selectively trigger:

```json
{
  "gates": {
    "test": {
      "keywords": ["test", "testing", "spec"],
      "command": "npm test"
    }
  },
  "hooks": {
    "UserPromptSubmit": {
      "gates": ["test"]
    }
  }
}
```

**Note:** Keywords only apply to UserPromptSubmit hook, not other hooks.

## Usage

Override this file in your project by creating `.claude/context/prompt-submit.md` with project-specific guidance.
