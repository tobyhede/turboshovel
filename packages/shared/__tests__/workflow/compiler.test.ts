import { describe, it, expect } from '@jest/globals';
import { createStepNumber } from '../../src/workflow/types.js';
import { compileWorkflowToMachine } from '../../src/workflow/compiler.js';
import type { Step } from '../../src/workflow/types.js';

describe('workflow compiler', () => {
  describe('dynamic step compilation', () => {
    it('compiles GOTO {N}.1 to target step_1 with substep', () => {
      const steps: Step[] = [
        {
          isDynamic: true,
          description: 'Execute task',
          prompts: [],
          substeps: [
            { id: '1', description: 'Implement', isDynamic: false, prompts: [] },
            {
              id: '2',
              description: 'Verify',
              isDynamic: false,
              prompts: [],
              transitions: {
                all: true,
                pass: { type: 'CONTINUE' },
                fail: { type: 'GOTO', target: { step: '{N}', substep: '1' } }
              }
            }
          ]
        }
      ];

      const machine = compileWorkflowToMachine(steps);
      expect(machine).toBeDefined();
      // Should not throw on GOTO {N} target
    });

    it('compiles NEXT action', () => {
      const steps: Step[] = [
        {
          isDynamic: true,
          description: 'Execute task',
          prompts: [],
          transitions: {
            all: true,
            pass: { type: 'NEXT' },
            fail: { type: 'DONE' }
          }
        }
      ];

      const machine = compileWorkflowToMachine(steps);
      expect(machine).toBeDefined();
      // Should not throw on NEXT action
    });

    it('compiles NEXT in substep transitions', () => {
      const steps: Step[] = [
        {
          isDynamic: true,
          description: 'Execute task',
          prompts: [],
          substeps: [
            {
              id: '1',
              description: 'Task',
              isDynamic: false,
              prompts: [],
              transitions: {
                all: true,
                pass: { type: 'NEXT' },
                fail: { type: 'CONTINUE' }
              }
            }
          ]
        }
      ];

      const machine = compileWorkflowToMachine(steps);
      expect(machine).toBeDefined();
    });

    it('compiles GOTO {N}.M within substeps', () => {
      const steps: Step[] = [
        {
          isDynamic: true,
          description: 'Dynamic step',
          prompts: [],
          substeps: [
            {
              id: '1',
              description: 'First substep',
              isDynamic: false,
              prompts: []
            },
            {
              id: '2',
              description: 'Second substep',
              isDynamic: false,
              prompts: [],
              transitions: {
                all: true,
                pass: { type: 'CONTINUE' },
                fail: { type: 'GOTO', target: { step: '{N}', substep: '1' } }
              }
            }
          ]
        }
      ];

      const machine = compileWorkflowToMachine(steps);
      expect(machine).toBeDefined();
    });
  });

  describe('static step compilation', () => {
    it('compiles standard GOTO with numeric target', () => {
      const steps: Step[] = [
        {
          number: createStepNumber(1)!,
          isDynamic: false,
          description: 'Step 1',
          prompts: [],
          transitions: {
            all: true,
            pass: { type: 'CONTINUE' },
            fail: { type: 'GOTO', target: { step: createStepNumber(2)! } }
          }
        },
        {
          number: createStepNumber(2)!,
          isDynamic: false,
          description: 'Step 2',
          prompts: []
        }
      ];

      const machine = compileWorkflowToMachine(steps);
      expect(machine).toBeDefined();
    });
  });
});
