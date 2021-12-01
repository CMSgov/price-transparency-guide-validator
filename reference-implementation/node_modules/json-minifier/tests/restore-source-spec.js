var minifier = require('../')();

describe('JSON minifier restore source logic', function() {
  var testCases = [
    {
      title: 'should properly restore nested objects',
      source: { key1: { key2: 4 } }
    },
    {
      title: 'should properly restore null objects',
      source: { key1: null }
    }
  ];

  testCases.forEach(function(testCase) {
    it(testCase.title, function() {
      var minified = minifier.minify(testCase.source);
      var unminified = minifier.unminify(minified);
      expect(unminified).toEqual(testCase.source);
    })
  });
});