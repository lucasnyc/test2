import { PyContext } from '../cse-machine/py_context';
import { ModuleConnectionError, ModuleInternalError } from './errors';
import { getRequireProvider } from './requireProvider';

// Using a default static URL as a fallback.
export let MODULES_STATIC_URL = 'http://127.0.0.1:8022';

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

        // Execute the module bundle as an IIFE.
        const moduleIIFE = new Function('require', bundleText);
        return moduleIIFE(require);
    } catch (error) {
        if (error instanceof ModuleConnectionError) {
        throw error;
        }
        // Wrap other errors as a ModuleInternalError.
        throw new ModuleInternalError(moduleName, error);
    }
    })();

    moduleCache.set(moduleName, loadPromise);
    return loadPromise;
}