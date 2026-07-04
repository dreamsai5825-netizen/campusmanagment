import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, buttonVariants } from './button';

describe('Button', () => {
  it('renders with children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Submit</Button>);
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies variant classes via buttonVariants', () => {
    const { container } = render(<Button variant="destructive">Delete</Button>);
    const btn = container.querySelector('button');
    expect(btn).toHaveClass('bg-destructive');
  });

  it('applies size classes', () => {
    const { container } = render(<Button size="lg">Large</Button>);
    const btn = container.querySelector('button');
    expect(btn).toHaveClass('h-11');
  });

  it('merges custom className', () => {
    const { container } = render(<Button className="custom-class">OK</Button>);
    const btn = container.querySelector('button');
    expect(btn).toHaveClass('custom-class');
  });
});

describe('buttonVariants', () => {
  it('returns default variant classes', () => {
    const classes = buttonVariants({});
    expect(classes).toContain('bg-primary');
  });
});
