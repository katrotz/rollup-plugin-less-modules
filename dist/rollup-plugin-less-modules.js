'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var _Object$keys = _interopDefault(require('babel-runtime/core-js/object/keys'));
var _defineProperty = _interopDefault(require('babel-runtime/helpers/defineProperty'));
var _JSON$stringify = _interopDefault(require('babel-runtime/core-js/json/stringify'));
var _regeneratorRuntime = _interopDefault(require('babel-runtime/regenerator'));
var _asyncToGenerator = _interopDefault(require('babel-runtime/helpers/asyncToGenerator'));
var _Array$from = _interopDefault(require('babel-runtime/core-js/array/from'));
var _Set = _interopDefault(require('babel-runtime/core-js/set'));
var _Object$assign = _interopDefault(require('babel-runtime/core-js/object/assign'));
var rollupPluginutils = require('rollup-pluginutils');
var path = require('path');
var fsExtra = require('fs-extra');
var less = _interopDefault(require('less'));
var CleanCSS = _interopDefault(require('clean-css'));

var cwd = process.cwd();

/**
 * Rollup plugin less modules provides the ability to import less content directly into the es module
 * @param {Object} iOptions The plugin options
 * @param {boolean|string|Function} iOptions.output Should the compiled styles be bundled together to a separate css file (default false)
 * @param {boolean} iOptions.minify Controls the minification of the resulting CSS content (default false)
 * @param {Function} iOptions.processor A callback function that when provided will be invoked with compiled CSS to perform additional transformations before the generate phase (default null)
 * @param {Object} iOptions.options The options to be provided to LESS while rendering the less files (default {})
 * @returns {*}
 */
var index = function () {
    var _this = this;

    var iOptions = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    var options = _Object$assign({
        output: false,
        minify: false,
        processor: null,
        options: {}
    }, iOptions);

    var inlineTransformedSourceMaps = false;

    var filter = rollupPluginutils.createFilter(options.include || ['**/*.less', '**/*.css'], options.exclude || 'node_modules/**');

    /**
     * A hash of compiled styles
     */
    var styles = {};

    /**
     * List of paths for lessJS to resolve the imports
     * @type {Set}
     */
    var pathsSet = new _Set([cwd]);

    /**
     * Replaces the file extension in the provided path
     * @param {string} filePath The file path
     * @param {string} fileExtension The file extension
     * @returns {string|null}
     */
    var toFileExtension = function toFileExtension(filePath, fileExtension) {
        return filePath && filePath.replace(path.extname(filePath), fileExtension) || null;
    };

    /**
     * Renders a less file source
     * @param {string} source The less file source
     * @param {string} filename The file relative path
     * @returns {css, map, imports}
     */
    var lessRender = function lessRender(source, filename) {
        var paths = _Array$from(pathsSet);

        return less.render(source, _Object$assign({ paths: paths, filename: filename, sourceMap: {} }, options.options));
    };

    /**
     * Minifies several css sources
     * @param {Object} minifySources An object with the keys as module Ids, and values objects like {styles, sourceMap}
     * @returns {Promise.<{css: string, map: string}>}
     */
    var minifyCss = function () {
        var _ref = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee(minifySources) {
            var output;
            return _regeneratorRuntime.wrap(function _callee$(_context) {
                while (1) {
                    switch (_context.prev = _context.next) {
                        case 0:
                            _context.next = 2;
                            return new CleanCSS({ sourceMap: true, returnPromise: true }).minify(minifySources);

                        case 2:
                            output = _context.sent;
                            return _context.abrupt('return', {
                                css: '' + output.styles,
                                map: '' + output.sourceMap
                            });

                        case 4:
                        case 'end':
                            return _context.stop();
                    }
                }
            }, _callee, _this);
        }));

        return function minifyCss(_x2) {
            return _ref.apply(this, arguments);
        };
    }();

    /**
     * Invokes the user defined post process function
     * @param {Object} iOutput An object having the less render output signature
     * @param {string} id The path to the less file
     * @returns {Promise.<{css: string, map: string}>}
     */
    var doPostProcess = function () {
        var _ref2 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee2(iOutput, id) {
            var output, processedOutput;
            return _regeneratorRuntime.wrap(function _callee2$(_context2) {
                while (1) {
                    switch (_context2.prev = _context2.next) {
                        case 0:
                            output = iOutput;

                            if (!(typeof options.processor === 'function')) {
                                _context2.next = 7;
                                break;
                            }

                            _context2.next = 4;
                            return options.processor(iOutput, id);

                        case 4:
                            _context2.t0 = _context2.sent;
                            _context2.next = 8;
                            break;

                        case 7:
                            _context2.t0 = iOutput;

                        case 8:
                            processedOutput = _context2.t0;


                            if (processedOutput.css && processedOutput.map) {
                                output = processedOutput;
                            } else {
                                _this.warn('Rollup less modules plugin skipped processor output due to an invalid return value');
                            }

                            return _context2.abrupt('return', output);

                        case 11:
                        case 'end':
                            return _context2.stop();
                    }
                }
            }, _callee2, _this);
        }));

        return function doPostProcess(_x3, _x4) {
            return _ref2.apply(this, arguments);
        };
    }();

    /**
     * Extends the less render output with an es-module export code
     * @param {css, map} output
     * @param {string} id
     * @returns {css, map, code}
     */
    var injectModuleExports = function injectModuleExports(output, id) {
        var map = typeof (output.map || { mappings: '' }) === 'string' ? JSON.parse(output.map) : output.map;

        var styles = output.css;

        // Inlines the source-maps into the styles exported as es-module
        if (inlineTransformedSourceMaps) {
            styles = styles + '\n' + getInlineSourceMapContent(map);
        }

        var dependencies = (output.imports || []).map(function (importee) {
            return path.join(path.relative(path.dirname(id), path.dirname(importee)), path.basename(importee));
        });

        // Generate the es-module dependencies based on the less imports to allow rollup watch detect changes in the dependent files
        // The proper rollup API fix for this behaviour still pending {@link https://github.com/rollup/rollup/issues/1203}
        var codeImports = dependencies.reduce(function (src, importee) {
            return src + 'import ".' + (path.sep + importee) + '";\n';
        }, '');

        var codeExports = 'export default ' + _JSON$stringify(styles) + ';\nexport const sourceMap = ' + _JSON$stringify(map) + ';';

        var code = codeImports + '\n' + codeExports;

        return _Object$assign(output, { code: code, map: map });
    };

    /**
     * Performs the sequence of less rendering, minification and post processing of a less source
     * @param {string} source The less file content
     * @param {string} id The less file path
     * @returns {Promise.<css|map|imports>}
     */
    var _transform = function () {
        var _ref3 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee3(source, id) {
            var filename, output, minifySources;
            return _regeneratorRuntime.wrap(function _callee3$(_context3) {
                while (1) {
                    switch (_context3.prev = _context3.next) {
                        case 0:
                            filename = path.relative(cwd, id);
                            _context3.next = 3;
                            return lessRender(source, filename);

                        case 3:
                            output = _context3.sent;


                            output.map = output.map ? JSON.parse(output.map) : output.map;

                            // Minify

                            if (!options.minify) {
                                _context3.next = 13;
                                break;
                            }

                            minifySources = _defineProperty({}, id, { styles: output.css, sourceMap: output.map });
                            _context3.t0 = _Object$assign;
                            _context3.t1 = output;
                            _context3.next = 11;
                            return minifyCss(minifySources);

                        case 11:
                            _context3.t2 = _context3.sent;
                            output = (0, _context3.t0)(_context3.t1, _context3.t2);

                        case 13:
                            if (!options.processor) {
                                _context3.next = 17;
                                break;
                            }

                            _context3.next = 16;
                            return doPostProcess(output, id);

                        case 16:
                            output = _context3.sent;

                        case 17:
                            return _context3.abrupt('return', output);

                        case 18:
                        case 'end':
                            return _context3.stop();
                    }
                }
            }, _callee3, _this);
        }));

        return function _transform(_x5, _x6) {
            return _ref3.apply(this, arguments);
        };
    }();

    /**
     * Generates the content of a sourceMap ready to be appended to the CSS content
     * @param {Object} sourceMap The sourceMap object
     * @returns {string} The content of the inlined sourceMap
     */
    var getInlineSourceMapContent = function getInlineSourceMapContent(sourceMap) {
        var sStringMap = typeof sourceMap === 'string' ? sourceMap : _JSON$stringify(sourceMap);
        var smBase64 = new Buffer(sStringMap).toString('base64');
        return '/*# sourceMappingURL=data:application/json;base64,' + smBase64 + ' */';
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
        options: function options(o) {
            inlineTransformedSourceMaps = o.sourceMap === 'inline';
        },

        /**
         * A source, id => code or source, id => { code, map } module transformer function
         * @param source
         * @param id
         * @returns {{code: null, map: {mappings: string}}|null}
         */
        transform: function transform(source, id) {
            var _this2 = this;

            return _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee4() {
                return _regeneratorRuntime.wrap(function _callee4$(_context4) {
                    while (1) {
                        switch (_context4.prev = _context4.next) {
                            case 0:
                                if (filter(id)) {
                                    _context4.next = 2;
                                    break;
                                }

                                return _context4.abrupt('return', null);

                            case 2:

                                // Store all the less file directories for less renderer to resolve relative paths
                                pathsSet.add(path.dirname(id));

                                _context4.t0 = injectModuleExports;
                                _context4.next = 6;
                                return _transform(source, id);

                            case 6:
                                _context4.t1 = _context4.sent;
                                _context4.t2 = id;
                                styles[id] = (0, _context4.t0)(_context4.t1, _context4.t2);
                                return _context4.abrupt('return', {
                                    code: styles[id].code,
                                    map: styles[id].map
                                });

                            case 10:
                            case 'end':
                                return _context4.stop();
                        }
                    }
                }, _callee4, _this2);
            }))();
        },
        ongenerate: function ongenerate(generateOptions, bundleObject) {
            var _this3 = this;

            return _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee5() {
                return _regeneratorRuntime.wrap(function _callee5$(_context5) {
                    while (1) {
                        switch (_context5.prev = _context5.next) {
                            case 0:
                                inlineTransformedSourceMaps = generateOptions.sourceMap === 'inline';

                            case 1:
                            case 'end':
                                return _context5.stop();
                        }
                    }
                }, _callee5, _this3);
            }))();
        },


        /**
         * Function hook called when bundle.write() is being executed, after the file has been written to disk.
         * Receives .write() options along with the underlying Bundle
         * @param {Object} writeOptions
         * @param {Object} bundleObject
         * @returns {Promise.<void>}
         */
        onwrite: function onwrite(writeOptions, bundleObject) {
            var _this4 = this;

            return _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee6() {
                var generateSourceMaps, inlineSourceMaps, dest, cssBundlePath, lessBundlePath, cssMapsBundlePath, lessSources, transformOutput, cssBundleContent, cssBundleSourceMaps;
                return _regeneratorRuntime.wrap(function _callee6$(_context6) {
                    while (1) {
                        switch (_context6.prev = _context6.next) {
                            case 0:
                                generateSourceMaps = writeOptions.sourceMap;
                                inlineSourceMaps = writeOptions.sourceMap === 'inline';
                                dest = writeOptions.dest;

                                if (!(!options.output || !dest)) {
                                    _context6.next = 5;
                                    break;
                                }

                                return _context6.abrupt('return');

                            case 5:
                                cssBundlePath = typeof options.output === 'string' ? options.output : toFileExtension(dest, '.css');
                                lessBundlePath = toFileExtension(cssBundlePath, '.less');
                                cssMapsBundlePath = cssBundlePath + '.map';

                                if (cssBundlePath) {
                                    _context6.next = 10;
                                    break;
                                }

                                return _context6.abrupt('return');

                            case 10:
                                _context6.prev = 10;

                                fsExtra.ensureFileSync(cssBundlePath);
                                _context6.next = 18;
                                break;

                            case 14:
                                _context6.prev = 14;
                                _context6.t0 = _context6['catch'](10);

                                _this4.warn(_context6.t0);
                                return _context6.abrupt('return');

                            case 18:

                                // Generate a less file that imports all the required less modules in the bundle
                                lessSources = _Object$keys(styles).reduce(function (src, id) {
                                    return src + '\n@import \'' + path.relative(path.dirname(lessBundlePath), id) + '\';';
                                }, '');

                                // Transform the generated less file using same workflow as for the bundle imported less modules

                                _context6.next = 21;
                                return _transform(lessSources, lessBundlePath);

                            case 21:
                                transformOutput = _context6.sent;
                                cssBundleContent = '' + transformOutput.css;
                                cssBundleSourceMaps = transformOutput.map;


                                if (generateSourceMaps) {
                                    if (inlineSourceMaps) {
                                        cssBundleContent += '\n' + getInlineSourceMapContent(cssBundleSourceMaps);
                                    } else {
                                        cssBundleContent += '\n/*# sourceMappingURL=' + path.basename(cssMapsBundlePath) + ' */';

                                        // Write the source-map file
                                        fsExtra.writeFileSync('' + cssMapsBundlePath, _JSON$stringify(cssBundleSourceMaps), 'utf8');
                                    }
                                }

                                // Write the LESS file used to generate the bundle CSS
                                fsExtra.writeFileSync(lessBundlePath, lessSources, 'utf8');

                                // Write the CSS bundle file
                                fsExtra.writeFileSync(cssBundlePath, cssBundleContent, 'utf8');

                            case 27:
                            case 'end':
                                return _context6.stop();
                        }
                    }
                }, _callee6, _this4, [[10, 14]]);
            }))();
        }
    };
};

module.exports = index;
