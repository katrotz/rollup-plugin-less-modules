import babel from 'rollup-plugin-babel'

export default {
    entry: './src/index.js',
    format: 'cjs',
    dest: 'dist/rollup-plugin-less-modules.js',
    external: [
        'babel-runtime/core-js/json/stringify',
        'babel-runtime/core-js/object/assign',
        'babel-runtime/helpers/defineProperty',
        'babel-runtime/core-js/array/from',
        'babel-runtime/core-js/set',
        'babel-runtime/core-js/object/keys',
        'babel-runtime/helpers/asyncToGenerator',
        'babel-runtime/regenerator',
        'fs',
        'util',
        'path',
        'less',
        'rollup-pluginutils',
        'fs-extra',
        'clean-css'
    ],
    plugins: [
        babel({
            runtimeHelpers: true
        })
    ]
}