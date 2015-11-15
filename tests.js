var OS = require('./index.js');
var _ = require('lodash');

var call_1, call_2, call_3;
var start = Date.now(), ms1, ms2, ms3;
var imdb = '0898266', show = 'The Big Bang Theory', s = '01', ep = '01';

var res = function (subtitles) {
    var total = 0;
    _.each(subtitles, function (lang) {
        total += lang.length
    });
    return total;
};

/** HTTPS search **/
var OpenSubtitles = new OS({
    useragent: 'OSTestUserAgent',
    endpoint: 'https://api.opensubtitles.org:443/xml-rpc'
});
OpenSubtitles.search({
    season: s,
    episode: ep,
    imdbid: imdb,
    limit: 'all'
})
.then(function (subtitles) {
    ms1 = Date.now() - start;
    call_1 = 'HTTPS search: ' + ms1 + 'ms and ' + res(subtitles) + ' results in ' + Object.keys(subtitles).length + ' langs';
})

/** HTTP search **/
.then(function () {
    var OpenSubtitles = new OS({
        useragent: 'OSTestUserAgent',
        endpoint: 'http://api.opensubtitles.org:80/xml-rpc'
    }); 
    return OpenSubtitles.search({
        season: s,
        episode: ep,
        imdbid: imdb,
        limit: 'all'
    });
})
.then(function (subtitles) {
    ms2 = Date.now() - start - ms1;
    call_2 = 'HTTP search:  ' + ms2 + 'ms and ' + res(subtitles) + ' results in ' + Object.keys(subtitles).length + ' langs';
})

/** serverinfo **/
.then(function () {
    var OpenSubtitles = new OS('OSTestUserAgent');
    return OpenSubtitles.api.ServerInfo();
})
.then(function (data) {
    ms3 = Date.now() - start - ms1 - ms2;
    call_3 = 'ServerInfo:   ' + ms3 + 'ms - ' + data.subs_subtitle_files + ' subtitles available';
})

/** results **/
.then(function () {
    //console.log('%s (tt%s), S%sE%s\n', show, imdb, s, ep)
    console.log(call_1);
    console.log(call_2);
    console.log(call_3);
})
.catch(function (err) {
    console.log(err);
});