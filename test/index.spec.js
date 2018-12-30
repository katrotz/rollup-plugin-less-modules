import test from 'ava';
import { rollup } from 'rollup';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import { resolve } from 'path';
import { existsSync, removeSync } from 'fs-extra';
import lessModules from './..';

const temporaryPath = resolve(__dirname, '.output', 'index');

test.before(t => {
    // Performing cleanup before running tests and not after so that the output can be manually inspected afterwards
    removeSync(temporaryPath);
});

test('should compile and import basic less files', async t => {
    const pluginOpts = {};
    const rollupInputOpts = {
        input: 'test/fixtures/basic/index.js',
        plugins: [ lessModules(pluginOpts) ]
    };
    const rollupOutputOpts = { format: 'es' };

    const bundle = await rollup(rollupInputOpts);
    const { output } = await bundle.generate(rollupOutputOpts);

    t.true(output[0].code.indexOf('body') >= 0);
});

test('should compile and import less files with imports', async t => {
    const pluginOpts = {};
    const rollupInputOpts = {
        input: 'test/fixtures/less-import/index.js',
        plugins: [ lessModules(pluginOpts) ]
    };
    const rollupOutputOpts = { format: 'es' };

    const bundle = await rollup(rollupInputOpts);
    const { output } = await bundle.generate(rollupOutputOpts);

    t.true(output[0].code.indexOf('body') >= 0);
});

test('should compile and post-process the styles', async t => {
    const pluginOpts = {
        options: { sourceMap: {} },
        processor: async function(tCode, id) {
            const postCssOptions = { from: id, to: id, map: { prev: tCode.map } };
            const result = await postcss([autoprefixer]).process(tCode.css, postCssOptions);

            return { css: result.css, map: result.map.toString() }
        }
    };
    const rollupInputOpts = {
        input: 'test/fixtures/post-process/index.js',
        plugins: [ lessModules(pluginOpts) ]
    };
    const rollupOutputOpts = { format: 'es' };

    const bundle = await rollup(rollupInputOpts);
    const { output } = await bundle.generate(rollupOutputOpts);

    t.true(output[0].code.indexOf('-ms-flexbox') >= 0);
});

test('should clean and minify the compiled CSS content', async t => {
    const pluginOpts = { minify: true };
    const rollupInputOpts = {
        input: 'test/fixtures/minify/index.js',
        plugins: [ lessModules(pluginOpts) ]
    };
    const rollupOutputOpts = { format: 'es' };

    const bundle = await rollup(rollupInputOpts);
    const { output } = await bundle.generate(rollupOutputOpts);

    t.true(output[0].code.indexOf('body{margin:0}') > 0);
});
