CubeSlider is a framework for modular robot reconfiguration in the sliding cube model. It lets you build a configuration and then apply reconfiguration algorithms to it.

## Building

CubeSlider uses webpack to bundle the JavaScript code and its dependencies into a bundle.

First install the dependencies:

```sh
npm install
```

Build the tool (output appears in the `dist` folder):

```sh
npm run build
```

This could show the following error:
```
opensslErrorStack: [ 'error:03000086:digital envelope routines::initialization error' ],
library: 'digital envelope routines',
reason: 'unsupported',
code: 'ERR_OSSL_EVP_UNSUPPORTED'
```

This means that you should use the legacy openssl before running build:
```sh
export NODE_OPTIONS=--openssl-legacy-provider
```

Run a development server that automatically rebuilds the bundle (and reloads the page in the browser) on code changes:

```sh
npm run start
```
