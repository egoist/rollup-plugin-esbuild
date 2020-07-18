# rollup-plugin-esbuild

![npm version](https://badgen.net/npm/v/rollup-plugin-esbuild) ![npm downloads](https://badgen.net/npm/dm/rollup-plugin-esbuild)

[esbuild](https://github.com/evanw/esbuild) is by far one of the fastest TS/ESNext to ES6 compilers and minifier, this plugin replaces `rollup-plugin-typescript2`, `@rollup/plugin-typescript` and `rollup-plugin-terser` for you.

## Install

```bash
yarn add esbuild rollup-plugin-esbuild --dev
```

## Usage

In `rollup.config.js`:

```js
import esbuild from 'rollup-plugin-esbuild'

export default {
  plugins: [
    esbuild({
      // All options are optional
      include: /\.[jt]sx?$/, // default, inferred from `loaders` option
      exclude: /node_modules/, // default
      watch: process.argv.includes('--watch'),
      sourceMap: false, // default
      minify: process.env.NODE_ENV === 'production',
      target: 'es2017' // default, or 'es20XX', 'esnext'
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment'
      // Like @rollup/plugin-replace
      define: {
        __VERSION__: '"x.y.z"'
      },
      // Add extra loaders
      loaders: {
        // Add .json files support
        // require @rollup/plugin-commonjs
        '.json': 'json',
        // Enable JSX in .js files too
        '.js': 'jsx'
      }
    }),
  ],
}
```

- `include` and `exclude` can be `String | RegExp | Array[...String|RegExp]`, when supplied it will override default values.
- It uses `jsxFactory`, `jsxFragmentFactory` and `target` options from your `tsconfig.json` as default values.

### Declaration File

There are serveral ways to generate declaration file:

- Use `tsc` with `emitDeclarationOnly`, the slowest way but you get type checking, it doesn't bundle the `.d.ts` files.
- Use [`rollup-plugin-dts`](https://github.com/Swatinem/rollup-plugin-dts) which generates and bundle `.d.ts`, also does type checking.
- Use [`api-extractor`](https://api-extractor.com/) by Microsoft, looks quite complex to me so I didn't try it, PR welcome to update this section.

## License

MIT &copy; [EGOIST (Kevin Titor)](https://github.com/sponsors/egoist)
