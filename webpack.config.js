const path = require("path");

module.exports = {
  entry: "./src/index.ts",
  output: {
    filename: "extension.js",
    path: path.resolve(__dirname),
    library: {
      type: "module",
    },
  },
  experiments: {
    outputModule: true,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  externals: {
    react: "var React",
    "react-dom": "var ReactDOM",
    "react-dom/client": "var ReactDOM",
  },
};
