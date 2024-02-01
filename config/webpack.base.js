const config = require("./base.config");
const HtmlWebpackPlugin = require("html-webpack-plugin");
module.exports = {
  entry: {
    main: config.mainPath,
  },
  output: {
    path: config.outputPath,
  },
  resolve: {
    extensions: [".js", ".json", ".ts", ".less", ".css"],
  },
  module: {
    rules: [
      {
        test: /\.((j|t)sx?)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env", "@babel/preset-react"],
              plugins: ["@babel/plugin-proposal-class-properties"],
            },
          },
          {
            loader: "awesome-typescript-loader",
            options: {
              silent: true,
              configFileName: config.tsConfigPath,
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.less$/,
        use: ["style-loader", "css-loader", "less-loader"],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: config.templatePath,
      showErrors: true,
    }),
  ],
};
