import { PyContext } from "../cse-machine/py_context"

/**
 * Returns a function that simulates the job of Node's `require`. The require
 * provider is then used by Source modules to access the context and py-slang standard
 * library
 */
export const getRequireProvider = (context: PyContext) => (x: string) => {
  const pathSegments = x.split('/')

  const recurser = (obj: Record<string, any>, segments: string[]): any => {
    if (segments.length === 0) return obj
    const currObj = obj[segments[0]]
    if (currObj !== undefined) return recurser(currObj, segments.splice(1))
    throw new Error(`Dynamic require of ${x} is not supported`)
  }

  const exports = {
    'py-slang': {
      context,
    },
  }

  return recurser(exports, pathSegments);
};

export type RequireProvider = ReturnType<typeof getRequireProvider>