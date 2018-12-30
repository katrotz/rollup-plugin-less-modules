import babel from 'rollup-plugin-babel'

export default {
    input: './src/index.js',
    output: {
        format: 'cjs',
        file: 'dist/rollup-plugin-less-modules.js',
    },
    external: [
        'fs',
        'util',
        'path',
        'less',
        'rollup-pluginutils',
        'fs-extra',
        'clean-css',
        '@babel/runtime/helpers/defineProperty',
        '@babel/runtime/regenerator',
        '@babel/runtime/helpers/asyncToGenerator'
    ],
    plugins: [
        babel({
            runtimeHelpers: true
        })
    ]
}
