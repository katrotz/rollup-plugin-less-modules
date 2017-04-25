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

test('should compile and import basic less files', t => {
    return rollup({
        entry: 'test/fixtures/basic/index.js',
        plugins: [
            lessModules()
        ]
    })
    
    .then(bundle => bundle.generate({ format: 'es' }).code)

    .then(code => {
        t.true(code.indexOf('body') >= 0);
    })
    
    .catch(error => t.fail(`${error}`));
});

test('should compile and import less files with imports', t => {
    return rollup({
        entry: 'test/fixtures/less-import/index.js',
        plugins: [
            lessModules()
        ]
    })

    .then(bundle => bundle.generate({ format: 'es' }).code)
    
    .then(code => {
        t.true(code.indexOf('body') >= 0);
    })
    
    .catch(error => t.fail(`${error}`));
});

test('should compile and post-process the styles', t => {
    const options = {
        sourceMap: {}
    };

    const processor = function(tCode, id) {
        const postCssOptions = {
            from: id,
            to: id,
            map: {
                prev: tCode.map
            }
        };
        return postcss([autoprefixer])
            .process(tCode.css, postCssOptions)
            .then(result => ({
                css: result.css,
                map: result.map.toString()
            }))
    };

    return rollup({
        entry: 'test/fixtures/post-process/index.js',
        plugins: [
            lessModules({options, processor})
        ]
    })

    .then(bundle => bundle.generate({ format: 'es' }).code)

    .then(code => {
        t.true(code.indexOf('-ms-flexbox') >= 0);
    })
    
    .catch(error => t.fail(`${error}`))
});

test('should clean and minify the compiled CSS content', t => {
    const lessOptions = {};

    return rollup({
        entry: 'test/fixtures/minify/index.js',
        plugins: [
            lessModules({
                minify: true
            })
        ]
    })

    .then(bundle => bundle.generate({ format: 'es' }).code)

    .then(code => {
        t.true(code.indexOf('body{margin:0}') > 0)
    })

    .catch(error => t.fail(`${error}`))
});
