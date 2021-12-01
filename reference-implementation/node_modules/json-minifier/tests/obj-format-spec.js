var minifier = require('../')();

function doneCallback(done){
  return function(){
    done();
  };
}

var item;

describe('JSON Minifier object formatting', function() {
  it('should keep array type when input is an array', function(done){
    minifier = require('../')({ key2: 'k' });
    item = minifier.minify([{ key2: 'something' }]);
    expect(item.length).not.toBe(undefined);
    done();
  });

  it('should keep object type when input is an object', function(done){
    minifier = require('../')({ key2: 'k' });
    item = minifier.minify({ key2: 'something' });
    expect(item.length).toBe(undefined);
    done();
  });
});