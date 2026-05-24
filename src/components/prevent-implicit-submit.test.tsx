import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { preventImplicitSubmit } from './prevent-implicit-submit';

afterEach(cleanup);

describe('preventImplicitSubmit', () => {
  it('prevents Enter from implicitly submitting text inputs', () => {
    const onSubmit = vi.fn();

    render(<TestForm onSubmit={onSubmit} />);

    expect(
      fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter' }),
    ).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('allows textarea Enter and explicit submit button activation', () => {
    const onSubmit = vi.fn();

    render(<TestForm onSubmit={onSubmit} />);

    expect(
      fireEvent.keyDown(screen.getByLabelText('Note'), { key: 'Enter' }),
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledOnce();
  });
});

function TestForm({ onSubmit }: { onSubmit: () => void }) {
  return (
    <form
      onKeyDown={preventImplicitSubmit}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label>
        Name
        <input />
      </label>
      <label>
        Note
        <textarea />
      </label>
      <button type="submit">Save</button>
    </form>
  );
}
