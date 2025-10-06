const path = require("path");

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Configurar resolução de módulos para resolver problemas com extensões
      webpackConfig.resolve.extensionAlias = {
        '.js': ['.ts', '.tsx', '.js', '.jsx'],
        '.mjs': ['.mts', '.mjs']
      };

      // Adicionar fallback para resolver módulos MUI
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
      };

      // Configurar resolução de módulos para node_modules
      webpackConfig.resolve.modules = [
        ...webpackConfig.resolve.modules,
        path.resolve(__dirname, 'node_modules'),
        'node_modules'
      ];

      return webpackConfig;
    },
  },
};
