# rollup-plugin-esbuild

## Install

```bash
yarn add rollup-plugin-esbuild --dev
```

## Usage

```js
import esbuild from 'rollup-plugin-esbuild'

export default {
  plugins: [
    esbuild({
      watch: process.env.NODE_ENV === 'development'
    })
  ]
}
```

## License

MIT &copy; [EGOIST (Kevin Titor)](https://github.com/sponsors/egoist)