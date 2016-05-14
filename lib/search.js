var OS = require('./opensubtitles.js'),
    libhash = require('./hash.js'),
    Promise = require('bluebird'),
    _ = require('lodash');

var LibSearch = function() {};

LibSearch.prototype.optimizeQueryTerms = function(input) {
    var checkHash = function() {
        return new Promise(function(resolve, reject) {
            if (!input.hash && !input.path) {
                resolve(false);
            }
            var tmpObj = {};

            if (!input.hash && input.path) {
                // calc hash if path exists
                libhash.computeHash(input.path)
                    .then(resolve)
                    .catch(reject);
            } else {
                tmpObj.moviehash = input.hash;
                if (input.filesize) {
                    tmpObj.moviebytesize = input.filesize.toString();
                }
                resolve(tmpObj);
            }
        });
    };


    return new Promise(function(resolve, reject) {
        var i = 0,
            output = [];

        checkHash().then(function(obj) {
            // first data call
            if (obj) {
                output[i] = obj;
                i++;
            }

            // second data call
            if (input.filename || input.path) {
                output[i] = {};
                output[i].tag = input.filename || require('path').basename(input.path);
                i++;
            }

            // third data call
            if (input.imdbid) {
                output[i] = {};
                output[i].imdbid = input.imdbid.toString().replace('tt', '');

                if (input.season && input.episode) {
                    output[i].season = parseInt(input.season).toString();
                    output[i].episode = parseInt(input.episode).toString();
                }
                i++;
            }

            // fallback
            if (!input.imdbid && !input.hash && !input.path && !input.filename && input.query) {
                output[i] = {};
                output[i].query = input.query;

                if (input.season && input.episode) {
                    output[i].season = parseInt(input.season).toString();
                    output[i].episode = parseInt(input.episode).toString();
                }
                i++;
            }

            // mandatory parameter
            _.each(output, function(obj) {
                obj.sublanguageid = input.sublanguageid || 'all';
            });

            resolve(output);
        }).catch(reject);
    });
};

LibSearch.prototype.optimizeSubs = function(response, input) {
    // based on OpenSRTJS, under MIT - Copyright (c) 2014 Eóin Martin

    return new Promise(function(resolve, reject) {
        var subtitles = {};

        // if string passed as supported extension, convert to array
        if (input.extensions && typeof input.extensions === 'string') {
            input.extensions = [input.extensions];
        }

        // if no supported extensions passed, default to 'srt'
        if (!input.extensions || !input.extensions instanceof Array) {
            input.extensions = ['srt'];
        }

        _.each(response, function(sub) {

            if (input.extensions.indexOf(sub.SubFormat) == -1) {
                return;
            }

            // imdbid check
            if (input.imdbid) {
                // tv episode
                if (sub.SeriesIMDBParent && sub.SeriesIMDBParent.toString() !== '0') {
                    if (parseInt(sub.SeriesIMDBParent, 10) !== parseInt(input.imdbid.toString().replace('tt', ''), 10)) {
                        return;
                    }
                    // movie
                } else {
                    if (sub.IDMovieImdb && parseInt(sub.IDMovieImdb, 10) !== parseInt(input.imdbid.toString().replace('tt', ''), 10)) {
                        return;
                    }
                }
            }

            // episode check
            if (input.season && input.episode) {
                if (sub.SeriesSeason !== parseInt(input.season).toString()) {
                    return;
                }
                if (sub.SeriesEpisode !== parseInt(input.episode).toString()) {
                    return;
                }
            }

            var tmp = {};
            tmp.url = input.gzip ? sub.SubDownloadLink : sub.SubDownloadLink.replace('.gz', '');
            tmp.lang = sub.ISO639;
            tmp.downloads = sub.SubDownloadsCnt;
            tmp.langName = sub.LanguageName;
            tmp.encoding = sub.SubEncoding;
            tmp.id = sub.IDSubtitleFile;
            tmp.score = 0;

            if (sub.MatchedBy === 'moviehash') {
                tmp.score += 8;
            }
            if (sub.MatchedBy === 'tag') {
                tmp.score += 7;
            }
            if (sub.MatchedBy === 'imdbid') {
                tmp.score += 5;
                if (sub.MovieFPS && input.fps && parseInt(sub.MovieFPS) > 0) {
                    if (sub.MovieFPS.startsWith(input.fps) || input.fps.toString().startsWith(sub.MovieFPS)) {
                        tmp.score += 0.5;
                    }
                }
            }
            if (sub.MatchedBy.match(/moviehash|tag|imdbid/) === null) {
                if (sub.MovieFPS && input.fps && parseInt(sub.MovieFPS) > 0) {
                    if (sub.MovieFPS.startsWith(input.fps) || input.fps.toString().startsWith(sub.MovieFPS)) {
                        tmp.score += 2;
                    }
                }
            }
            if (sub.UserRank === 'trusted' || sub.UserRank === 'administrator') {
                tmp.score += 4;
            }
            if (sub.UserRank === 'platinum member' || sub.UserRank === 'gold member') {
                tmp.score += 3;
            }

            // store subs for sorting
            if (!subtitles[tmp.lang]) {
                subtitles[tmp.lang] = [];
                subtitles[tmp.lang][0] = tmp;
            } else {
                subtitles[tmp.lang][Object.keys(subtitles[tmp.lang]).length] = tmp;
            }
        });

        resolve(subtitles);
    });
};

LibSearch.prototype.filter = function(list, input) {

    return new Promise(function(resolve, reject) {
        var subtitles = {},
            langcode;

        if (!input.limit || (isNaN(input.limit) && ['best', 'all'].indexOf(input.limit.toLowerCase()) == -1)) {
            input.limit = 'best';
        }

        _.each(list, function(lang) {
            langcode = lang[0].lang;

            // sort by score, sub-sort by downloads
            lang = lang.sort(function(a, b) {
                if (a.score === b.score) {
                    var x = a.downloads,
                        y = b.downloads;
                    return y < x ? -1 : y > x ? 1 : 0;
                }
                return b.score - a.score;
            });

            // filter
            switch (input.limit.toString().toLowerCase()) {
                case 'best':
                    // keep only the first (best) item
                    subtitles[langcode] = lang[0];
                    break;
                case 'all':
                    // all good already
                    subtitles[langcode] = lang;
                    break;
                default:
                    // keep only n = input.limit items
                    subtitles[langcode] = lang.slice(0, parseInt(input.limit));
            };
        });

        resolve(subtitles);
    });
};

module.exports = new LibSearch();