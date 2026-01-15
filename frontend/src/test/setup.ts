import '@testing-library/jest-dom';
import { vi, expect } from 'vitest';
import { axe } from 'vitest-axe';

// Mock global objects needed for tests
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Custom matcher for accessibility tests
expect.extend({
  async toHaveNoAccessibilityViolations(container: HTMLElement) {
    const results = await axe(container);

    if (results.violations.length === 0) {
      return {
        message: () => 'Expected accessibility violations but found none',
        pass: true,
      };
    }

    const violationMessages = results.violations.map(violation => {
      return `- ${violation.id}: ${violation.description}\n  Help: ${violation.helpUrl}\n  Impact: ${violation.impact}\n  Elements: ${violation.nodes.map(node => node.html).join(', ')}`;
    }).join('\n\n');

    return {
      message: () => `Expected no accessibility violations but found ${results.violations.length}:\n\n${violationMessages}`,
      pass: false,
    };
  },
});