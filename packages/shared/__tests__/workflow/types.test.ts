import { SubtaskState } from '../../src/workflow/types';

describe('SubtaskState type', () => {
  it('has required fields', () => {
    const subtaskState: SubtaskState = {
      id: '1',
      status: 'pending',
      agentId: undefined,
      result: undefined
    };

    expect(subtaskState.id).toBe('1');
    expect(subtaskState.status).toBe('pending');
  });
});
