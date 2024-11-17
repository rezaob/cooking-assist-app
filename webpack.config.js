const webpack = require('@nativescript/webpack');
const path = require('path');

module.exports = (env) => {
  webpack.init(env);

  webpack.chainWebpack((config) => {
    config.resolve.fallback = {
      http: false,
      https: false,
      util: false,
      stream: false,
      zlib: false,
      url: false
    };
  });

  return webpack.resolveConfig();
};