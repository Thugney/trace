import 'vitest';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- generic must match vitest's Assertion<T> for declaration merging
  interface Assertion<T = any> {
    toHaveNoAccessibilityViolations(): Promise<void>;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoAccessibilityViolations(): Promise<void>;
  }
}
