<!--
  Phase 1: Dual Independent Review
  - Dispatch 2 agents in parallel with identical prompts
  - Each agent reviews subject against ground truth independently
  - Each agent saves review to .work/{date}-verify-{type}-{time}.md

  Phase 2: Collate Findings
  - Dispatch review-collation-agent
  - Parse both reviews completely
  - Identify common issues (VERY HIGH confidence)
  - Identify exclusive issues (MODERATE confidence)
  - Identify divergences (agents disagree)
  - If divergences: dispatch verification agent to resolve
  - Save collation to .work/{date}-verify-{type}-collated-{time}.md
  - Present summary to user immediately
  - Tell user: "Can /revise common now"

  Phase 3: Cross-check (background)
  - Dispatch appropriate agent to validate exclusive issues
  - For each exclusive issue: verify against ground truth
  - Assign: VALIDATED / INVALIDATED / UNCERTAIN
  - Save to .work/{date}-verify-{type}-crosscheck-{time}.md
  - Update collation report with validation status
  - Tell user: "Cross-check complete. /revise exclusive ready"
-->

Note: starting the workflow is not part of the workflow
Will need a workflow skill



<!--
MainAgent
 -- workflow start verify.workflow.md
 -- >
 --  1. Dispatch agents for independent analysis
 --  Prompt<Optional>
-->
## 1. Dispatch agents for independent analysis

  Prompt<Optional>

  ### 1.(a..z) Dispatch agent

    Prompt<Optional>
<!--
MainAgent
 -- workflow start --task 1.a
 -- >
 --  Ok or something

SubAgent
 -- workflow start --agent xyx agent.workflow.md
 -- >
 --  1. First task from agent workflow
 --  Prompt<Optional>

SubAgent (Final task - completes workflow)
 -- workflow next --agent xyx
 -- >
 --  Ok
 --

MainAgent
 -- workflow next
 -- >
 --  2. Second task
 --  Prompt<Optional>
-->



## 1. Dispatch two agents for independent analysis


    ### 1.A First reviewer (code-review-agent)
<!--
MainAgent
 -- workflow start --task 1.A
-->
    ### 1.B Second reviewer (code-agent)

<!--
MainAgent
 -- workflow start --task 1.B
-->

Both systematically review code against coding standards and requirements.

- PASS ALL: CONTINUE
- FAIL: STOP "Reviewer failed"



