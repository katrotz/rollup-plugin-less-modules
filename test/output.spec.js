import test from 'ava';
import { rollup } from 'rollup';
import { resolve, join } from 'path';
import { existsSync, removeSync } from 'fs-extra';
import lessModules from './..';

const temporaryPath = resolve(__dirname, '.output', 'output');
const testTitleToFileName = (testName = '') => (testName.replace(/\s/g, '-'));

test.before(t => {
    // Performing cleanup before running tests and not after so that the output can be manually inspected afterwards
    removeSync(temporaryPath);
});

test('should output generated css bundle for single output file', async t => {
    const dest = resolve(temporaryPath, testTitleToFileName(t.title));
    const pluginOpts = { output: true, sourcemap: false };
    const rollupInputOpts = {
        input: 'test/fixtures/output/index.js',
        plugins: [ lessModules(pluginOpts) ]
    };
    const rollupOutputOpts = { format: 'es', file: `${dest}.js` };

    const bundle = await rollup(rollupInputOpts);
    await bundle.write(rollupOutputOpts);

    t.true(existsSync(`${dest}.css`));
    t.false(existsSync(`${dest}.css.map`));
});


test('should output generated css bundle for multiple output files', async t => {
    const dest = resolve(temporaryPath, testTitleToFileName(t.title));
    const fileBaseName = 'dynamic-importer';
    const pluginOpts = { output: true, sourcemap: false };
    const rollupInputOpts = {
        input: `test/fixtures/output/${fileBaseName}.js`,
        plugins: [ lessModules(pluginOpts) ]
    };
    const rollupOutputOpts = { format: 'es', dir: dest };

    const bundle = await rollup(rollupInputOpts);
    await bundle.write(rollupOutputOpts);

    t.true(existsSync(`${join(dest, fileBaseName)}.css`));
    t.false(existsSync(`${join(dest, fileBaseName)}.css.map`));
});

test('should output generated css bundle using output path override', async t => {
    const dest = resolve(temporaryPath, testTitleToFileName(t.title));
    const cssDest = resolve(temporaryPath, testTitleToFileName(t.title + '-override.css'));
    const pluginOpts = { output: cssDest, sourcemap: false };
    const rollupInputOpts = {
        input: 'test/fixtures/output/index.js',
        plugins: [ lessModules(pluginOpts) ]
    };
    const rollupOutputOpts = { format: 'es', file: `${dest}.js` };

    const bundle = await rollup(rollupInputOpts);
    await bundle.write(rollupOutputOpts);

    t.true(existsSync(`${cssDest}`));
    t.false(existsSync(`${dest}.css`));
});
