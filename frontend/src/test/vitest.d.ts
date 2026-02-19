import { Assertion } from 'vitest';

declare module 'vitest' {
  interface Assertion<T = any> extends Assertion<T> {
    toHaveNoAccessibilityViolations(): Promise<void>;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoAccessibilityViolations(): Promise<void>;
  }
}