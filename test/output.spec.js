import test from 'ava';
import { rollup } from 'rollup';
import { resolve } from 'path';
import { existsSync, removeSync } from 'fs-extra';
import lessModules from './..';

const temporaryPath = resolve(__dirname, '.output', 'output');

test.before(t => {
    // Performing cleanup before running tests and not after so that the output can be manually inspected afterwards
    removeSync(temporaryPath);
});

test('should output generated css bundle', t => {
    const dest = resolve(temporaryPath, t._test.title.replace(/\s/g, '-'));

    return rollup({
        entry: 'test/fixtures/output/index.js',
        dest: `${dest}.js`,
        plugins: [
            lessModules({
                output: true
            })
        ]
    })

    .then(bundle => bundle.generate({ format: 'es' }) && bundle.write({ format: 'es', dest: `${dest}.js` }))

    .then(() => {
        t.true(existsSync(`${dest}.css`));
        t.false(existsSync(`${dest}.css.map`));
    })

    .catch(error => t.fail(`${error}`));
});