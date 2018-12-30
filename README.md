# rollup-plugin-less-modules
[![Build Status](https://travis-ci.org/katrotz/rollup-plugin-less-modules.svg)](https://travis-ci.org/katrotz/rollup-plugin-less-modules)

The [rollup](https://github.com/rollup/rollup) less modules plugin compiles the LESS files into CSS before importing them into ES modules.
A use case would be an [Angular](https://github.com/angular/angular) application that defines the styles at the component level, or any other component based application that implements styles encapsulation.

Why is it awesome?
+ It can collect and bundle all the imported less files and output the CSS content into a separate CSS bundle file
+ It plays nicely with the source maps. Source maps can be imported into ES module, can be exported to a separate file and can be inlined into the CSS content (for both imported into ES module or exported to file). 
+ It automagically detects the changes in the dependent less files and recompiles the bundle when rollup is run in watch mode 

# Installation
```
npm install --save-dev rollup-plugin-less-modules
```

# Usage
After compilation the less styles are available along with the source:  

###### rollup.config.js
```
import { rollup } from 'rollup';
import lessModules from 'rollup-plugin-less-modules';

rollup({
    entry: 'index.js',
    sourceMap: true,
    plugins: [
        lessModules()
    ]
})
```

###### index.less
```
@import "typography"
body {
    margin: 0;
}
```

###### typography.less
```
html {
    font-size: 100%;
}
```

###### index.js
```
import style, { sourceMap } from './index.less';

/* The application handles the styles based on the needs */
```

# Options

### minify
+ **Description** Minifies the compiled styles using [clean-css](https://github.com/jakubpawlowicz/clean-css)
+ **Default** `false`

### sourcemap
+ **Description** Controls the generation of source maps for the compiled Less files. Follows the rollup pattern for ES modules (true|false|'inline') to output into a separate map file or inline the source maps into the generated CSS file.
+ **Default** `true`

### options
+ **Description** Defines the options passed to [Less.js compiler](https://github.com/less/less.js). See below the *Source maps* section for more details of how to configure this option to get correct paths in the source maps.
+ **Default** 
```
{
    // Contains the cwd and the imported less files directories 
    paths: Array,

    // The relative path from the repository root to the file
    filename: String,

    // The source map configuration for [LESS](http://lesscss.org/usage/#programmatic-usage)
    sourceMap: {}
}
```
+ 
### processor
+ **Description** An optional post processing callback. It receives an object with `{css: '', map: {mappings: ''}}` signature. The `css` contains the compiled css content and the `map` contains the source maps. An object with the same signature should be returned otherwise the post-processing result is ignored.
+ **Default** `null`
+ **Example**
```
import { rollup } from 'rollup';
import lessModules from 'rollup-plugin-less-modules';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';

const options = {
    sourceMap: {}
};

const processor = (code, id) => {
    const postCssOptions = {
        from: id,
        to: id,
        map: {
            prev: code.map
        }
    };
    return postcss([autoprefixer])
        .process(code.css, postCssOptions)
        .then(result => ({
            css: result.css,
            map: result.map
        }));
};

return rollup({
    entry: 'index.js',
    plugins: [
        lessModules({options, processor})
    ]
})
```

### output
+ **Description** Configures the plugin to write the styles to a separate bundle file. When a string is provided as value, it interprets it as the destination path for the CSS bundle file.
+ **Default** `false`
+ **Example**
```
return rollup({
    input: 'index.js',
    output: {
        file: 'dist/app.js'
    },
    plugins: [
        lessModules({
            // Does not output the styles to an external file
            // output: false,

            // Outputs the styles to a separate bundle file with the same name as the input file name of the bundle.
            // output: true,

            // Outputs the bundled styles to a custom path
            // output: 'dist/app.css'
        })
    ]
})
```

# Source maps
The plugin provides means to configure and use the source maps. The source maps are provided only when the plugin is run with the `sourcemap` option enabled.

The source maps can be accessed in the ES module. Eg. 
`import { sourceMap } from 'path-to-styles.less'`

When the source maps are configured to be inlined, the content is embedded into the CSS content as a base64 string

By default the source map paths to the original files are relative to the package root path (eg. `src/components/component/less/styles.less`)
To make the paths look like `/components/component/less/styles.less`, following less configuration required

```
return rollup({
    entry: 'index.js',
    dest: 'src/bundles/app.js'
    plugins: [
        lessModules({
            // Defaults to src/bundles/app.css
            output: true,
            
            // less options
            options: {
                sourceMap: {
                    sourceMapRootpath: `/`,
                    sourceMapBasepath: `src` 
                }
            }
        })
    ]
})
```

# License
MIT
