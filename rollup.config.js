import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';

/**
 * @type {import('rollup').RollupOptions}
 */
const config = [{
  input: 'src/conductor/PyEvaluator.ts',
  output: {
    dir: 'dist',
    entryFileNames: 'python-evaluator.cjs',
    format: 'cjs',
    name: 'PySlangEvaluator',
    sourcemap: true
  },
  plugins: [commonjs(), json(), typescript(), nodeResolve()]
}, {
  input: 'src/index.ts',
  output: {
    file: 'dist/worker.js',
    format: 'umd',
    name: 'PySlangWorker',
    exports: 'named', // Specify named exports
    sourcemap: true,
    inlineDynamicImports: true
  },
  plugins: [commonjs(), json(), typescript(), nodeResolve()]
}];

export default config;
