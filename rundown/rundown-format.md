# title
[ description ]

{ static_steps | dynamic_step }

where static_steps is:
  static_step [ static_step ... ]

where static_step is:
  "##" integer title
    { body | substeps | workflows }
    [ transition ... ]

where dynamic_step is:
  "##" "{N}" title
    { body | substeps | workflows }
    [ transition ... ]

where substeps is:
  substep [ substep ... ]

where substep is:
  "###" substep_id title
    { body | workflows }
    [ transition ... ]

where substep_id is:
  parent_ref "." { integer | "{n}" }

where parent_ref is:
  integer    -- for static parent
  | "{N}"    -- for dynamic parent

where body is:
  [ prompt_text ]
  [ ```bash
    command
    ``` ]

where workflows is:
  - workflow_path [ ... ]

where transition is:
  - { PASS | FAIL } [ { ALL | ANY } ]: result

where result is:
  action | RETRY [ count ] [ action ]

where action is:
  CONTINUE | DONE | STOP [ "message" ] | GOTO id | NEXT
