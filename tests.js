var OS = require('./index.js');
var _ = require('lodash');

var call_1, call_2, call_3;
var start = Date.now(), ms1, ms2, ms3;
var imdb = '0898266', show = 'The Big Bang Theory', s = '01', ep = '01';
var UA = 'OSTestUserAgentTemp';

var res = function (subtitles) {
    var total = 0;
    _.each(subtitles, function (lang) {
        total += lang.length
    });
    return total;
};

var call = function () {
    return OpenSubtitles.search({
        season: s,
        episode: ep,
        imdbid: imdb,
        limit: 'all'
    });
};

var OpenSubtitles = new OS({
    useragent: UA,
    ssl: true
});

call().then(function (subtitles) {
    /** HTTPS search **/
    ms1 = Date.now() - start;
    call_1 = '> HTTPS search: ' + ms1 + 'ms and ' + res(subtitles) + ' results in ' + Object.keys(subtitles).length + ' langs';
}).then(function () {
    var OpenSubtitles = new OS({
        useragent: UA,
        ssl: false
    }); 
    return call();
}).then(function (subtitles) {
    /** HTTP search **/
    ms2 = Date.now() - start - ms1;
    call_2 = '> HTTP search:  ' + ms2 + 'ms and ' + res(subtitles) + ' results in ' + Object.keys(subtitles).length + ' langs';
}).then(function () {
    var OpenSubtitles = new OS(UA);
    return OpenSubtitles.api.ServerInfo();
}).then(function (data) {
    /** serverinfo **/
    ms3 = Date.now() - start - ms1 - ms2;
    call_3 = '> ServerInfo:   ' + ms3 + 'ms - ' + data.subs_subtitle_files + ' subtitles available';
}).then(function () {
    /** results **/
    console.log('## %s (tt%s) - S%sE%s ##', show, imdb, s, ep);
    console.log(call_1);
    console.log(call_2);
    console.log(call_3);
}).catch(function (err) {
    console.log(err);
});