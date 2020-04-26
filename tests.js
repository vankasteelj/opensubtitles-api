const OS = require('./index.js');
const assert = require('assert');
const UA = 'TemporaryUserAgent';
const imdb = '0898266', show = 'The Big Bang Theory', s = '01', ep = '01';

let os, test;

test = 'http client';
os = new OS({
    useragent: UA,
    ssl: false
});
console.time(test);
os.api.ServerInfo().then(() => {
    console.timeEnd(test);

    test = 'https client';
    os = new OS({
        useragent: UA,
        ssl: true
    });
    console.time(test);
    return os.api.ServerInfo();
}).then(() => {
    console.timeEnd(test);

    test = 'search';
    console.time(test);
    return os.search({
        season: s,
        episode: ep,
        imdbid: imdb,
        limit: 'all'
    });
}).then(() => {
    test = 'identify';
    console.time(test);
    return os.identify({
        moviehash: '8e245d9679d31e12',
        moviebytesize: 1234,
        extend: true,
    });
}).then((res) => {
    console.timeEnd(test);
    assert.equal(res.metadata.title, 'The Simpsons Movie');
    console.log('Passed test.');
    process.exit(0);
}).catch((err) => {
    console.log('Test failed');
    console.log(err);
    process.exit(1);
});
