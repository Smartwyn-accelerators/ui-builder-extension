module.exports = {
    entry: './ext-src/extention.ts',
    mode: 'development',
    module: {
        rules: [
          {
            test: /\.tsx?$/,
            use: 'ts-loader',
            exclude: /node_modules/,
          },
        ],
    },
    externals: {
        fs:    "commonjs fs",
        'ts-file-parser': "commonjs ts-file-parser",
        'vscode': '@types/vscode' // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
      path: `${__dirname}/dist`,
      filename: 'extention.js',
    },
  };