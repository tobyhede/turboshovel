# Code Review Workflow

A workflow with static subtasks for parallel code review by multiple specialized agents.

## 1. Dispatch reviewers

Launch parallel review agents to analyze the code from different perspectives.

### 1.1 Code quality reviewer (code-review-agent)

Review the implementation for code quality, patterns, and best practices.

**Prompt:** Analyze the code changes for:
- Code style consistency
- Design pattern usage
- Error handling
- Performance implications

Write findings to `.work/{date}-review-quality.md`.

### 1.2 Security reviewer (security-agent)

Review the implementation for security vulnerabilities.

**Prompt:** Analyze the code changes for:
- Input validation
- Authentication/authorization issues
- SQL injection, XSS, CSRF risks
- Secrets exposure

Write findings to `.work/{date}-review-security.md`.

### 1.3 Documentation reviewer (docs-agent)

Review documentation accuracy and completeness.

**Prompt:** Analyze the code changes for:
- Missing or outdated documentation
- Unclear function/method descriptions
- Example code accuracy

Write findings to `.work/{date}-review-docs.md`.

- PASS ALL: CONTINUE
- FAIL ANY: STOP "Review found critical issues"

## 2. Collate findings

Combine all review findings into a single report.

**Prompt:** Read all review outputs from `.work/{date}-review-*.md` files and create a consolidated report at `.work/{date}-review-summary.md`. Group findings by severity (critical, warning, info).

- PASS: DONE
- FAIL: STOP
