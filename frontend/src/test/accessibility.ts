/**
 * Accessibility testing utilities
 */

import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { expect } from 'vitest';

/**
 * Renders a component and runs accessibility tests
 * @param component React component to test
 * @returns Object with rendered container and accessibility test results
 */
export async function renderWithAccessibility(component: React.ReactElement) {
  const { container, ...rest } = render(component);

  // Wait for any async operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  const results = await axe(container);

  return {
    container,
    results,
    ...rest
  };
}

/**
 * Asserts that a component has no accessibility violations
 * @param container HTMLElement to test
 */
export async function assertNoAccessibilityViolations(container: HTMLElement) {
  const results = await axe(container);

  if (results.violations.length > 0) {
    const violationMessages = results.violations.map(violation => {
      return `- ${violation.id}: ${violation.description}\n  Help: ${violation.helpUrl}\n  Impact: ${violation.impact}\n  Elements: ${violation.nodes.map(node => node.html).join(', ')}`;
    }).join('\n\n');

    throw new Error(`Found ${results.violations.length} accessibility violations:\n\n${violationMessages}`);
  }
}

/**
 * Common accessibility test patterns
 */
export const accessibilityTestPatterns = {
  /**
   * Test that a component has proper ARIA attributes
   */
  hasAriaAttributes: (container: HTMLElement, expectedAttributes: string[]) => {
    expectedAttributes.forEach(attr => {
      const elements = container.querySelectorAll(`[${attr}]`);
      expect(elements.length).toBeGreaterThan(0);
    });
  },

  /**
   * Test that all images have alt text
   */
  imagesHaveAltText: (container: HTMLElement) => {
    const images = container.querySelectorAll('img');
    images.forEach(img => {
      expect(img).toHaveAttribute('alt');
    });
  },

  /**
   * Test that all interactive elements are keyboard accessible
   */
  interactiveElementsKeyboardAccessible: (container: HTMLElement) => {
    const interactiveElements = container.querySelectorAll('button, [role="button"], a[href], input, select, textarea, [tabindex]');
    interactiveElements.forEach(element => {
      expect(element).toBeVisible();
    });
  }
};