import { PyContext } from '../cse-machine/py_context';
import { ModuleConnectionError, ModuleInternalError } from './errors';
import { getRequireProvider } from './requireProvider';

// Using a default static URL as a fallback.
export let MODULES_STATIC_URL = 'https://source-academy.github.io/modules';

export function setModulesStaticURL(url: string) {
    MODULES_STATIC_URL = url;
}

// Module cache for performance and circular dependency resolution.
const moduleCache = new Map<string, Promise<any>>();

export async function loadModuleBundle(
    moduleName: string,
    context: PyContext,
): Promise<any> {
    if (moduleCache.has(moduleName)) {
        return moduleCache.get(moduleName);
    }

    const loadPromise = (async () => {
        const bundleUrl = `${MODULES_STATIC_URL}/bundles/${moduleName}.js`;
        try {
            const response = await fetch(bundleUrl);
            if (!response.ok) {
                throw new ModuleConnectionError();
            }
            const bundleText = await response.text();
            const require = getRequireProvider(context);

            // Create a Blob URL from the fetched text to handle ES module syntax correctly.
            const blob = new Blob([bundleText], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            const module = await import(/* webpackIgnore: true */ url);
            URL.revokeObjectURL(url); // Clean up the object URL.

            // The default export of the module is the function we need.
            const moduleFactory = module.default;
            return moduleFactory(require);
        } catch (error) {
            if (error instanceof ModuleConnectionError) {
                throw error;
            }
            // Wrap other errors as a ModuleInternalError
            throw new ModuleInternalError(moduleName, error);
        }
    })();

    moduleCache.set(moduleName, loadPromise);
    return loadPromise;
}