import test from 'ava';
import { rollup } from 'rollup';
import { resolve } from 'path';
import { existsSync, removeSync, readJsonSync } from 'fs-extra';
import lessModules from './..';

const SOURCE_MAP_URL_REGEX = new RegExp('/*# sourceMappingURL=');
const INLINE_SOURCE_MAP_REGEX = new RegExp('\/\*# sourceMappingURL=data:application\/json;');

const temporaryPath = resolve(__dirname, '.output', 'source-maps');
const testTitleToFileName = (testName = '') => (testName.replace(/\s/g, '-'));

test.before(t => {
    // Performing cleanup before running tests and not after so that the output can be manually inspected afterwards
    removeSync(temporaryPath);
});

test('should export "sourceMap" binding to ES module', async t => {
    const pluginOptions = {};
    const rollupInputOpts = {
        input: 'test/fixtures/sourcemaps/import-source-maps.js',
        plugins: [ lessModules(pluginOptions) ]
    };
    const rollupOutputOpts = { format: 'es' };

    const bundle = await rollup(rollupInputOpts);
    const { output } = await bundle.generate(rollupOutputOpts);

    t.true(output[0].code.indexOf('"mappings"') >= 0);
});

test('should generate inline sourcemaps', async t => {
    const dest = resolve(temporaryPath, testTitleToFileName(t.title));
    const pluginOptions = { sourcemap: 'inline', output: false };
    const rollupInputOpts = {
        input: 'test/fixtures/sourcemaps/import-styles.js',
        plugins: [ lessModules(pluginOptions) ]
    };
    const rollupOutputOpts = { format: 'es', sourcemap: 'inline', file: `${dest}.js` };

    const bundle = await rollup(rollupInputOpts);

    const { output } = await bundle.generate(rollupOutputOpts);
    await bundle.write(rollupOutputOpts);

    t.true(INLINE_SOURCE_MAP_REGEX.test(output[0].code));
    t.false(existsSync(`${dest}.css`));
    t.false(existsSync(`${dest}.css.map`));
});

test('should output sourcemaps to a file', async t => {
    const dest = resolve(temporaryPath, testTitleToFileName(t.title));
    const pluginOptions = { output: true, sourcemap: true };
    const rollupInputOpts = {
        input: 'test/fixtures/sourcemaps/import-styles.js',
        plugins: [ lessModules(pluginOptions) ]
    };
    const rollupOutputOpts = { format: 'es', file: `${dest}.js`, sourcemap: true };

    const bundle = await rollup(rollupInputOpts);
    await bundle.write(rollupOutputOpts);


    t.true(existsSync(`${dest}.css`));
    t.true(existsSync(`${dest}.css.map`));
    t.true(readJsonSync(`${dest}.css.map`, {throws: false}) !== null);
});
