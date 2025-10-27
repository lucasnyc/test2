import resolve from "@rollup/plugin-node-resolve";
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';



/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
  input: 'src/index.ts',
  output: {
    file: 'dist/worker.js',
    format: 'umd',
    name: 'PySlangWorker',
    sourcemap: true
  },
    plugins: [commonjs(), typescript({tsconfig: './tsconfig.json'}), resolve()]
};

export default config;
