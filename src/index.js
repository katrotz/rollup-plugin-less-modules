import { createFilter } from 'rollup-pluginutils';
import { dirname, relative, extname, basename, join } from 'path'
import { ensureFileSync, writeFileSync } from 'fs-extra';
import less from 'less';
import CleanCSS from 'clean-css';

const cwd = process.cwd();

/**
 * Rollup plugin less modules provides the ability to import less content directly into the es module
 * @param {Object} iOptions The plugin options
 * @param {boolean|string|Function} iOptions.output Should the compiled styles be bundled together to a separate css file (default false)
 * @param {boolean} iOptions.minify Controls the minification of the resulting CSS content (default false)
 * @param {Function} iOptions.processor A callback function that when provided will be invoked with compiled CSS to perform additional transformations before the generate phase (default null)
 * @param {Object} iOptions.options The options to be provided to LESS while rendering the less files (default {})
 * @returns {*}
 */
export default function(iOptions = {}) {
    const options = Object.assign({
        output: false,
        minify: false,
        processor: null,
        options: {}
    }, iOptions);

    let inlineTransformedSourceMaps = false;

    const filter = createFilter(options.include || [ '**/*.less', '**/*.css' ], options.exclude || 'node_modules/**');

    /**
     * A hash of compiled styles
     */
    const styles = {};

    /**
     * List of paths for lessJS to resolve the imports
     * @type {Set}
     */
    const pathsSet = new Set([cwd]);

    /**
     * Replaces the file extension in the provided path
     * @param {string} filePath The file path
     * @param {string} fileExtension The file extension
     * @returns {string|null}
     */
    const toFileExtension = (filePath, fileExtension) => {
        return (filePath && filePath.replace(extname(filePath), fileExtension) || null);
    };

    /**
     * Renders a less file source
     * @param {string} source The less file source
     * @param {string} filename The file relative path
     * @returns {css, map, imports}
     */
    const lessRender = (source, filename) => {
        const paths = Array.from(pathsSet);

        return less.render(source, Object.assign({ paths, filename, sourceMap: {} }, options.options));
    };

    /**
     * Minifies several css sources
     * @param {Object} minifySources An object with the keys as module Ids, and values objects like {styles, sourceMap}
     * @returns {Promise.<{css: string, map: string}>}
     */
    const minifyCss = async (minifySources) => {
        const output = await (new CleanCSS({ sourceMap: true, returnPromise: true })).minify(minifySources);

        return {
            css: `${output.styles}`,
            map: `${output.sourceMap}`
        }
    };

    /**
     * Invokes the user defined post process function
     * @param {Object} iOutput An object having the less render output signature
     * @param {string} id The path to the less file
     * @returns {Promise.<{css: string, map: string}>}
     */
    const doPostProcess = async (iOutput, id) => {
        let output = iOutput;
        let processedOutput = (typeof options.processor === 'function') ? await options.processor(iOutput, id) : iOutput;

        if (processedOutput.css && processedOutput.map) {
            output = processedOutput;
        } else {
            this.warn('Rollup less modules plugin skipped processor output due to an invalid return value');
        }

        return output;
    };

    /**
     * Extends the less render output with an es-module export code
     * @param {css, map} output
     * @param {string} id
     * @returns {css, map, code}
     */
    const injectModuleExports = (output, id) => {
        const map = (typeof (output.map || {mappings: ''}) === 'string') ? JSON.parse(output.map) : output.map;

        let styles = output.css;

        // Inlines the source-maps into the styles exported as es-module
        if (inlineTransformedSourceMaps) {
            styles = `${styles}\n${getInlineSourceMapContent(map)}`
        }

        const dependencies = (output.imports || [])
            .map(importee => join(
                relative(dirname(id), dirname(importee)),
                basename(importee)
            ));

        // Generate the es-module dependencies based on the less imports to allow rollup watch detect changes in the dependent files
        // The proper rollup API fix for this behaviour still pending {@link https://github.com/rollup/rollup/issues/1203}
        const codeImports = dependencies.reduce((src, importee) => `${src}import "./${importee}";\n`, '');

        const codeExports = `export default ${JSON.stringify(styles)};\nexport const sourceMap = ${JSON.stringify(map)};`;

        const code = `${codeImports}\n${codeExports}`;

        return Object.assign(output, {code, map});
    };

    /**
     * Performs the sequence of less rendering, minification and post processing of a less source
     * @param {string} source The less file content
     * @param {string} id The less file path
     * @returns {Promise.<css|map|imports>}
     */
    const transform = async (source, id) => {
        const filename = relative(cwd, id);

        let output = await lessRender(source, filename);

        output.map = output.map ? JSON.parse(output.map) : output.map;

        // Minify
        if (options.minify) {
            let minifySources = {
                [id]: {styles: output.css, sourceMap: output.map}
            };

            output = Object.assign(output, await minifyCss(minifySources));
        }

        // Post processing
        if (options.processor) {
            output = await doPostProcess(output, id);
        }

        return output;
    };

    /**
     * Generates the content of a sourceMap ready to be appended to the CSS content
     * @param {Object} sourceMap The sourceMap object
     * @returns {string} The content of the inlined sourceMap
     */
    const getInlineSourceMapContent = (sourceMap) => {
        const sStringMap = (typeof sourceMap === 'string') ? sourceMap : JSON.stringify(sourceMap);
        let smBase64 = (new Buffer(sStringMap)).toString('base64');
        return `/*# sourceMappingURL=data:application/json;base64,${smBase64} */`;
    };

    return {
        /**
         * The name of the plugin, for use in error messages and warnings
         */
        name: 'less-modules',

        /**
         * A function that replaces or manipulates the options object passed to rollup.rollup
         * @param o
         */
        options: (o) => {
            inlineTransformedSourceMaps = (o.sourceMap === 'inline');
        },

        /**
         * A source, id => code or source, id => { code, map } module transformer function
         * @param source
         * @param id
         * @returns {{code: null, map: {mappings: string}}|null}
         */
        async transform(source, id) {
            if (!filter(id)) {
                return null;
            }

            // Store all the less file directories for less renderer to resolve relative paths
            pathsSet.add(dirname(id));

            styles[id] = injectModuleExports(
                await transform(source, id), id
            );

            return {
                code: styles[id].code,
                map: styles[id].map
            };
        },

        async ongenerate(generateOptions, bundleObject) {
            inlineTransformedSourceMaps = (generateOptions.sourceMap === 'inline');
        },

        /**
         * Function hook called when bundle.write() is being executed, after the file has been written to disk.
         * Receives .write() options along with the underlying Bundle
         * @param {Object} writeOptions
         * @param {Object} bundleObject
         * @returns {Promise.<void>}
         */
        async onwrite(writeOptions, bundleObject) {
            const generateSourceMaps = writeOptions.sourceMap;
            const inlineSourceMaps = (writeOptions.sourceMap === 'inline');

            const dest = writeOptions.dest;

            if (!options.output || !dest) {
                return;
            }

            let cssBundlePath = (typeof options.output === 'string') ? options.output : toFileExtension(dest, '.css');
            let lessBundlePath = toFileExtension(cssBundlePath, '.less');
            let cssMapsBundlePath = `${cssBundlePath}.map`;

            if (!cssBundlePath) {
                return;
            }

            try {
                ensureFileSync(cssBundlePath);
            } catch (err) {
                this.warn(err);
                return;
            }

            // Generate a less file that imports all the required less modules in the bundle
            const lessSources = Object.keys(styles).reduce((src, id) => `${src}\n@import '${relative(dirname(lessBundlePath), id)}';`, '');

            // Transform the generated less file using same workflow as for the bundle imported less modules
            const transformOutput = await transform(lessSources, lessBundlePath);

            let cssBundleContent = `${transformOutput.css}`;

            const cssBundleSourceMaps = transformOutput.map;

            if (generateSourceMaps) {
                if (inlineSourceMaps) {
                    cssBundleContent += `\n${getInlineSourceMapContent(cssBundleSourceMaps)}`;
                } else {
                    cssBundleContent += `\n/*# sourceMappingURL=${basename(cssMapsBundlePath)} */`;

                    // Write the source-map file
                    writeFileSync(`${cssMapsBundlePath}`, JSON.stringify(cssBundleSourceMaps), 'utf8');
                }
            }

            // Write the LESS file used to generate the bundle CSS
            writeFileSync(lessBundlePath, lessSources, 'utf8');

            // Write the CSS bundle file
            writeFileSync(cssBundlePath, cssBundleContent, 'utf8');
        }
    }
};
