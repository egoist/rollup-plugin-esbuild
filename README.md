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

## License

MIT &copy; [EGOIST (Kevin Titor)](https://github.com/sponsors/egoist)
