const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
  mode: 'production',
  module: {
    noParse: [
      /src\/model-io-node\.js/,
      /src\/runners-node\.js/,
      /node_modules\/vm2\//
    ]
  },
  plugins: [
    new CleanWebpackPlugin()
  ]
};
