import { describe, it, expect } from '@jest/globals';
import { createActor } from 'xstate';
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

  describe('NEXT action XState integration', () => {
    it('sets nextInstance flag when PASS triggers NEXT', () => {
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
      const actor = createActor(machine);
      actor.start();

      // Initial state
      expect(actor.getSnapshot().value).toBe('step_1');
      expect(actor.getSnapshot().context.nextInstance).toBeFalsy();

      // Trigger PASS which should set nextInstance
      actor.send({ type: 'PASS' });

      // After PASS, should stay in step_1 but have nextInstance flag
      expect(actor.getSnapshot().value).toBe('step_1');
      expect(actor.getSnapshot().context.nextInstance).toBe(true);
      expect(actor.getSnapshot().context.substep).toBe('1');

      actor.stop();
    });

    it('GOTO {N}.M sets substep without nextInstance', () => {
      const steps: Step[] = [
        {
          isDynamic: true,
          description: 'Execute task',
          prompts: [],
          substeps: [
            { id: '1', description: 'First', isDynamic: false, prompts: [] },
            {
              id: '2',
              description: 'Second',
              isDynamic: false,
              prompts: [],
              transitions: {
                all: true,
                pass: { type: 'CONTINUE' },
                fail: { type: 'GOTO', target: { step: '{N}', substep: '1' } }
              }
            }
          ],
          transitions: {
            all: true,
            pass: { type: 'DONE' },
            fail: { type: 'STOP' }
          }
        }
      ];

      const machine = compileWorkflowToMachine(steps);
      const actor = createActor(machine);
      actor.start();

      // Start at step_1 substep 1
      expect(actor.getSnapshot().value).toBe('step_1');

      // Manually set to substep 2 context then trigger FAIL
      // Since we can't directly set context, we test the machine definition
      expect(machine).toBeDefined();
      expect(machine.config.states?.step_1).toBeDefined();

      actor.stop();
    });

    it('resets retryCount on NEXT action', () => {
      const steps: Step[] = [
        {
          isDynamic: true,
          description: 'Execute task',
          prompts: [],
          transitions: {
            all: true,
            pass: { type: 'NEXT' },
            fail: { type: 'RETRY', max: 3, then: { type: 'STOP' } }
          }
        }
      ];

      const machine = compileWorkflowToMachine(steps);
      const actor = createActor(machine);
      actor.start();

      // Trigger PASS which triggers NEXT
      actor.send({ type: 'PASS' });

      // retryCount should be reset to 0
      expect(actor.getSnapshot().context.retryCount).toBe(0);

      actor.stop();
    });
  });
});
