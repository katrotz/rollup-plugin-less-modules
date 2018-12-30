import { createFilter } from 'rollup-pluginutils';
import { dirname, relative, extname, basename, join, sep } from 'path'
import { ensureFileSync, writeFileSync } from 'fs-extra';
import less from 'less';
import CleanCSS from 'clean-css';

const cwd = process.cwd();
const SOURCEMAP_INLINE = 'inline';

/**
 * Rollup plugin less modules provides the ability to import less content directly into the es module
 * @param {Object} options The plugin options
 * @param {(boolean|string)=} options.output Should the compiled styles be bundled to a separate css file, can be used to override the destination file path
 * @param {(boolean|string)=} options.sourcemap If true, a separate sourcemap file will be created. If inline, the sourcemap will be appended to the resulting output file as a data URI
 * @param {boolean=} options.minify Controls the minification of the resulting CSS content
 * @param {Function=} options.processor A callback function that when provided will be invoked with compiled CSS to perform additional transformations before the generate phase
 * @param {Object=} options.options The options to be provided to LESS while rendering the less files
 * @returns {Object}
 */
export default function(options = {}) {
    const pluginOptions = Object.assign({
        output: false,
        sourcemap: true,
        minify: false,
        processor: null,
        options: {}
    }, options);

    const generateSourceMaps = !!pluginOptions.sourcemap;

    const inlineSourceMaps = pluginOptions.sourcemap === SOURCEMAP_INLINE;

    const filter = createFilter(pluginOptions.include || [ '**/*.less', '**/*.css' ], pluginOptions.exclude || 'node_modules/**');

    let rollupInput = null;

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

        return less.render(source, Object.assign({ paths, filename, sourceMap: {} }, pluginOptions.options));
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
        let processedOutput = (typeof pluginOptions.processor === 'function') ? await pluginOptions.processor(iOutput, id) : iOutput;

        if (processedOutput.css && processedOutput.map) {
            output = processedOutput;
        } else {
            this.warn('Rollup less modules plugin ignored processor output due to an invalid return value');
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
        if (inlineSourceMaps) {
            styles = `${styles}\n${getInlineSourceMapContent(map)}`
        }

        const dependencies = (output.imports || [])
            .map(importee => join(
                relative(dirname(id), dirname(importee)),
                basename(importee)
            ));

        // TODO check for new rollup API addWatchFile
        // Generate the es-module dependencies based on the less imports to allow rollup watch detect changes in the dependent files
        // The proper rollup API fix for this behaviour still pending {@link https://github.com/rollup/rollup/issues/1203}
        const codeImports = dependencies.reduce((src, importee) => `${src}import ".${sep + importee}";\n`, '');

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
        if (pluginOptions.minify) {
            let minifySources = {
                [id]: {styles: output.css, sourceMap: output.map}
            };

            output = Object.assign(output, await minifyCss(minifySources));
        }

        // Post processing
        if (pluginOptions.processor) {
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
        let smBase64 = (Buffer.from(sStringMap)).toString('base64');
        return `/*# sourceMappingURL=data:application/json;base64,${smBase64} */`;
    };

    const resolveCssBundlePath = (outputOptions) => {
        const outputBundleFile = outputOptions.file;
        const outputBundleDir = outputOptions.dir;
        const inputFileName = basename(rollupInput);

        // Uses this plugin override CSS bundle path if provided
        if (typeof pluginOptions.output === 'string') {
            return pluginOptions.output;
        }

        // Write the CSS file in the same path as the bundle file
        if (outputBundleFile) {
            return toFileExtension(outputBundleFile, '.css');
        }

        // Output the CSS file to the configured multi chunk directory using the input file name
        return toFileExtension(join(outputBundleDir, inputFileName), '.css');
    };

    return {
        name: 'less-modules',

        options(inputOptions) {
            rollupInput = inputOptions.input || this.warn('Expecting entry file to be defined on the InputOptions#input');
        },

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

        async generateBundle(outputOptions, bundleObject, isWrite) {
            const destinationFile = outputOptions.file;
            const destinationDir = outputOptions.dir;

            if (isWrite && pluginOptions.output && (destinationFile || destinationDir)) {
                let cssBundlePath = resolveCssBundlePath(outputOptions);
                let lessBundlePath = toFileExtension(cssBundlePath, '.less');
                let cssMapsBundlePath = `${cssBundlePath}.map`;

                if (!cssBundlePath) {
                    return;
                }

                try {
                    ensureFileSync(cssBundlePath);
                } catch (error) {
                    this.error(error);
                    return;
                }

                // Generate a less file that imports all the required less modules in the bundle
                const lessSources = Object.keys(styles).reduce((src, id) => `${src ? src + '\n' : src}@import '${relative(dirname(lessBundlePath), id)}';`, '');

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
    }
};
