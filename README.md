# rollup-plugin-esbuild

[esbuild](https://github.com/evanw/esbuild) is by far one of the fastest TS/ESNext to ES6 compilers, so it makes sense to use it over Babel/TSC with Rollup to take advantage of both worlds (Speed and the Rollup plugin ecosytem).

## Install

```bash
yarn add rollup-plugin-esbuild --dev
```

## Usage

In `rollup.config.js`:

```js
import esbuild from 'rollup-plugin-esbuild'

export default {
  plugins: [
    esbuild({
      // All options are optional
      include: /\.[jt]sx?$/, // default
      exclude: /node_modules/, // default
      watch: process.argv.includes('--watch'),
      minify: process.env.NODE_ENV === 'production',
      target: 'es2015' // default, or 'es20XX', 'esnext'
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment'
      // Like @rollup/plugin-replace
      define: {
        __VERSION__: '"x.y.z"'
      }
    }),
  ],
}
```

- `include` and `exclude` can be `String | RegExp | Array[...String|RegExp]`, when supplied it will override default values.

### Declaration File

There are serveral ways to generate declaration file:

- Use `tsc` with `emitDeclarationOnly`, the slowest way but you get type checking, it doesn't bundle the `.d.ts` files.
- Use [`rollup-plugin-dts`](https://github.com/Swatinem/rollup-plugin-dts) which generates and bundle `.d.ts`, no type checking so it's very fast.
- Use [`api-extractor`](https://api-extractor.com/) by Microsoft, looks quite complex to me so I didn't try it, PR welcome to update this section.

### Type Checking

> How do I get type checking then? VS Code only shows type errors for opened files!

You can enable type checking in testing, for example use [jest](https://jestjs.io/) with [ts-jest](https://github.com/kulshekhar/ts-jest) to run tests, here's an example [jest config file](./jest.config.js).

## License

MIT &copy; [EGOIST (Kevin Titor)](https://github.com/sponsors/egoist)
