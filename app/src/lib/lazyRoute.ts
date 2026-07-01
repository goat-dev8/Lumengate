import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

type ModuleLoader<T extends ComponentType<unknown>> = () => Promise<{ default: T }>;

/** Retry lazy chunk load once — avoids blank screens after deploy or flaky navigation. */
export function lazyRoute<T extends ComponentType<unknown>>(
  loader: ModuleLoader<T>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await loader();
    } catch (firstError) {
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      try {
        return await loader();
      } catch {
        throw firstError;
      }
    }
  });
}
