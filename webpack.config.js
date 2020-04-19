const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const config = require("./config");

module.exports = [
  {
    context: __dirname + "/",
    entry: ['@babel/polyfill', config.src.client.js],
    output: {
      path: path.resolve(process.cwd(), config.dist.client),
      filename: config.dest.client,
    },
    devServer: {
      contentBase: config.dist.client,
      hot: true,
      port: 9000
    },
    resolve: {
      extensions: [".js"],
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          loader: ["babel-loader"]
        },
      ],
    },
    plugins: [
      new CopyWebpackPlugin([
        {
          from: config.src.client.html,
          to: ".",
        },
        {
          from: config.src.client.quillCss,
          to:'.' 
        }
      ]),
    ],
    watch: false,
    devtool: 'source-map'
  },
];
