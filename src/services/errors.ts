export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export const isAbortError = (e: unknown) => (e as { name?: string })?.name === 'AbortError';

export const errorMessage = (e: unknown) =>
  e instanceof ApiError ? e.message : (e as Error)?.message || 'Something went wrong.';

export const abortError = () => Object.assign(new Error('Aborted'), { name: 'AbortError' });
