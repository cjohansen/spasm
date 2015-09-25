module.exports = function(config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', 'referee', 'browserify'],

    files: [
      // Don't watch these files - gets in the way of watchify (which gets activated when autoWatch is true)
      {pattern: 'test/**/*.js', watched: false, included: true, served: true}
    ],

    browserify: {
      transform: ['babelify'],
      debug: true
    },

    preprocessors: {
      'test/**/*.js': [ 'browserify' ]
    },

    reporters: ['progress'],
    port: 9666,
    colors: true,
    logLevel: config.LOG_INFO, // LOG_DISABLE, LOG_ERROR, LOG_WARN, LOG_DEBUG
    autoWatch: true,
    browsers: ['Chrome'],
    singleRun: false
  });
};
