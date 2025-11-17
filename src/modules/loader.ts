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
    console.log(`[loader] Attempting to load module: ${moduleName}`);
    if (moduleCache.has(moduleName)) {
        console.log(`[loader] Module ${moduleName} found in cache.`);
        return moduleCache.get(moduleName);
    }

    const loadPromise = (async () => {
        const bundleUrl = `${MODULES_STATIC_URL}/bundles/${moduleName}.js`;
        console.log(`[loader] Fetching from URL: ${bundleUrl}`);
        try {
            const response = await fetch(bundleUrl);
            if (!response.ok) {
                console.error(`[loader] Fetch failed for ${moduleName}: Status ${response.status}`);
                throw new ModuleConnectionError();
            }
            const bundleText = await response.text();
            console.log(`[loader] Successfully fetched bundle for ${moduleName}. Length: ${bundleText.length}`);
            const require = getRequireProvider(context);

            console.log(`[loader] Executing module IIFE for ${moduleName}.`);
            // Execute the module bundle as an IIFE.
            const moduleIIFE = new Function('require', bundleText);
            const result = moduleIIFE(require);
            console.log(`[loader] Module IIFE executed for ${moduleName}. Result:`, result);
            return result;
        } catch (error) {
            if (error instanceof ModuleConnectionError) {
                console.error(`[loader] ModuleConnectionError for ${moduleName}:`, error);
                throw error;
            }
            console.error(`[loader] ModuleInternalError for ${moduleName}:`, error);
            // Wrap other errors as a ModuleInternalError
            throw new ModuleInternalError(moduleName, error);
        }
    })();

    moduleCache.set(moduleName, loadPromise);
    return loadPromise;
}