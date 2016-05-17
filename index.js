var OS = require('./lib/opensubtitles.js'),
    libhash = require('./lib/hash.js'),
    libsearch = require('./lib/search.js'),
    libupload = require('./lib/upload.js'),
    libid = require('./lib/identify.js'),
    Promise = require('bluebird');

/**
 * Construct the module's skeleton
 * @param {Object}|{String} creds - the required information to use OpenSubtitles, can be simply the UA
 *
 * @param {String}          creds.useragent - mandatory, the OpenSubtitles User Agent
 * @param {String}          creds.endpoint - optionnal, the endpoint to use.
 * @param {Boolean}         creds.ssl - optionnal, set to true to use https.
 * @param {String}          creds.username - optionnal, the username of a specific user
 * @param {String}          creds.password - optionnal, the password of a specific user (can be MD5)
 */
var OpenSubtitles = module.exports = function(creds) {
    if (!creds || (typeof creds === 'object' && !creds.useragent)) {
        throw new Error('Missing useragent');
    }

    this.credentials = {
        username: creds.username || '',
        password: creds.password || '',
        useragent: creds.useragent || creds,
        status: {}
    };

    OpenSubtitles.prototype.api = new OS(creds.endpoint, creds.ssl);
};

/**
 * Log-in as user or anonymously, returns a token
 */
OpenSubtitles.prototype.login = function() {
    var self = this;

    return new Promise(function(resolve, reject) {
        if (self.credentials.status.auth_as === self.credentials.username && self.credentials.status.ttl > Date.now()) {
            resolve({
                token: self.credentials.status.token,
                userinfo: self.credentials.userinfo
            });
        } else {
            self.api.LogIn(self.credentials.username, self.credentials.password, 'en', self.credentials.useragent)
                .then(function(response) {
                    if (response.token && (response.status && response.status.match(/200/))) {
                        self.credentials.status.ttl = Date.now() + 895000 // ~15 min;
                        self.credentials.status.token = response.token;
                        self.credentials.status.auth_as = self.credentials.username;
                        self.credentials.userinfo = response.data;
                        resolve({
                            token: response.token,
                            userinfo: response.data
                        });
                    } else {
                        self.credentials.status = {};
                        reject(response.status || 'LogIn unknown error');
                    }
                }).catch(reject);
        }
    });
};

/**
 * Search for subtitles
 * @param {Object}          info - information about the video to be subtitled
 *
 * @param {String}|{Array}  info.extensions - Accepted extensions, defaults to 'srt' (values: srt, sub, smi, txt, ssa, ass, mpl)
 * @param {String}|{Array}  info.sublanguageid - Desired subtitle lang, ISO639-3 langcode, defaults to 'all'
 * @param {String}          info.hash - Size + 64bit checksum of the first and last 64k
 * @param {String}          info.path - Absolute path to the video file, it allows to automatically calculate 'hash'
 * @param {String}|{Int}    info.filesize - Total size, in bytes
 * @param {String}          info.filename - The video file name. Better if extension is included
 * @param {String}|{Int}    info.season - If TV Episode
 * @param {String}|{Int}    info.episode - If TV Episode
 * @param {String}|{Int}    info.imdbid - IMDB id with or without leading 'tt'
 * @param {String}|{Int}    info.fps - Number of frames per sec in the video
 * @param {String}          info.query - Text-based query, this is not recommended
 * @param {String}|{Int}    info.limit - Number of subtitles to return for each language, can be 'best', 'all' or an arbitrary number. Defaults to 'best'
 */
OpenSubtitles.prototype.search = function(info) {
    var self = this,
        subs = [];

    return this.login()
        .then(function() {
            return libsearch.optimizeQueryTerms(info);
        })
        .map(function(optimizedQT) {
            return self.api.SearchSubtitles(self.credentials.status.token, [optimizedQT])
        })
        .each(function(result) {
            subs = subs.concat(result.data);
        })
        .then(function() {
            return libsearch.optimizeSubs(subs, info);
        })
        .then(function(list) {
            return libsearch.filter(list, info);
        });
};

/**
 * Upload a subtitle
 * @param {Object}          subtitle - information about the video to be subtitled
 *
 * @param {String}          subtitle.path - Mandatory, absolute path to the video file
 * @param {String}          subtitle.subpath - Mandatory, absolute path to the subtitle file
 * @param {String}|{Int}    subtitle.imdbid - Recommended, IMDB id with or without leading 'tt'
 * @param {String}          subtitle.sublanguageid - Optionnal, subtitle lang, ISO639-3 langcode (autodetected upstream)
 * @param {String}          subtitle.moviereleasename - Optionnal, the release tag/name
 * @param {String}          subtitle.movieaka - Optionnal, alternative title
 * @param {String}|{Int}    subtitle.moviefps - Optionnal, number of frames per sec
 * @param {String}|{Int}    subtitle.movieframes - Optionnal, total number of frames
 * @param {String}|{Int}    subtitle.movietimems - Optionnal, total time in milliseconds
 * @param {String}|{Boolean}subtitle.highdefinition - Optionnal, is the video more than 720p? '1' or '0', true or false
 * @param {String}|{Boolean}subtitle.hearingimpaired - Optionnal, does the subtitle have descriptions for every sound? '1' or '0', true or false
 * @param {String}|{Boolean}subtitle.automatictranslation - Optionnal, is the subtitle machine-translated? '1' or '0', true or false
 * @param {String}          subtitle.subauthorcomment - Optionnal, commentary for the uploaded subtitle
 * @param {String}          subtitle.subtranslator - Optionnal, person who translated the subtitles
 */
OpenSubtitles.prototype.upload = function(subtitle) {
    var self = this;
    return new Promise(function(resolve, reject) {
        var persistent_data = {};

        self.login()
            .then(function() {
                return libupload.createTryData(subtitle);
            })
            .then(function(tryArray) {
                persistent_data = tryArray.cd1;
                return self.api.TryUploadSubtitles(self.credentials.status.token, tryArray);
            })
            .then(function(response) {
                if (response.alreadyindb === 1) {
                    resolve(response); // it exists, don't go further
                } else {
                    persistent_data.subpath = subtitle.subpath; // inject subpath
                    return libupload.parseResponse(response, persistent_data);
                }
            })
            .then(libupload.createContent)
            .then(libupload.arrangeUploadData)
            .then(function(uploadArray) {
                return self.api.UploadSubtitles(self.credentials.status.token, uploadArray);
            })
            .then(function(response) {
                if (response.data !== '' && response.status.match(/200/)) {
                    resolve(response);
                } else {
                    throw new Error(response.status || 'UploadSubtitles unknown error');
                }
            })
            .catch(reject);
    });
};

/**
 * Extract Movie Hash & Movie Bytes Size from a video
 * @param {String}          path - Mandatory, absolute path to a video file
 */
OpenSubtitles.prototype.extractInfo = function(path) {
    if (!path) {
        throw new Error('Missing path');
    }
    return libhash.computeHash(path);
};

/**
 * Movie identification service, get imdb information, send moviehashes
 * @param {Object}          
 * 
 * @param {String}          path - Mandatory, absolute path to a video file
 * @param {String}          imdb - Optionnal, matching imdb id
 * @param {Boolean}         extend - Optionnal, fetches metadata from OpenSubtitles
 */
OpenSubtitles.prototype.identify = function(query) {
    if (!query && !query.path) {
        throw new Error('Missing path');
    }
    if (!query.path) query = {path: query};

    var self = this;

    return this.login()
        .then(function() {
            return self.extractInfo(query.path);
        })
        .then(function(info) {
            query.moviehash = info.moviehash;
            query.moviebytesize = info.moviebytesize;
            return self.api.CheckMovieHash(self.credentials.status.token, [query.moviehash]);
        })
        .then(function(response) {
            if (response.data !== '' && response.status.match(/200/)) {
                var id = query.imdb ? query.imdb : libid.readNFO(query.path);
                if (response.data[query.moviehash].length === 0 && id) {
                    return self.api.InsertMovieHash(self.credentials.status.token, [{
                        moviehash: query.moviehash,
                        moviebytesize: query.moviebytesize,
                        imdbid: id.replace('tt', ''),
                        moviefilename: require('path').basename(query.path)
                    }]);
                } else {
                    return response;
                }
            } else {
                throw new Error(response.status || 'OpenSubtitles unknown error');
            }
        })
        .then(function(response) {
            return libid.parseResponse(response, query);
        })
        .then(function(data) {
            if (data.metadata && data.metadata.imdbid && query.extend) {
                return self.api.GetIMDBMovieDetails(self.credentials.status.token, data.metadata.imdbid.replace('tt', '')).then(function(ext) {
                    return libid.extend(data, ext);
                });
            } else {
                return data;
            }
        });
};

/**
 * Extract md5 hash from a subtitle file
 * @param {String}          path - Mandatory, absolute path to a subtitle file
 */
OpenSubtitles.prototype.computeMD5 = function (path) {
    if (!path) {
        throw new Error('Missing path');
    }
    return libhash.computeMD5(path);
};