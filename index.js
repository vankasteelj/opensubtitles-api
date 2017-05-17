const OS = require('./lib/opensubtitles.js')
const libhash = require('./lib/hash.js')
const libsearch = require('./lib/search.js')
const libupload = require('./lib/upload.js')
const libid = require('./lib/identify.js')

module.exports = class OpenSubtitles {

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
    constructor(creds) {
        if (!creds || (typeof creds === 'object' && !creds.useragent)) throw Error('Missing useragent')

        this.credentials = {
            username: creds.username || String(),
            password: creds.password || String(),
            useragent: creds.useragent || creds,
            status: Object(),
            userinfo: Object()
        }

        this.api = new OS(creds.endpoint, creds.ssl)
    }


    /**
     * Log-in as user or anonymously, returns a token
     */
    login() {
        if (this.credentials.status.auth_as === this.credentials.username && this.credentials.status.ttl > Date.now()) {
            return Promise.resolve({
                token: this.credentials.status.token,
                userinfo: this.credentials.userinfo
            })
        }

        return this.api.LogIn(this.credentials.username, this.credentials.password, 'en', this.credentials.useragent).then(response => {
            if (response.token && (response.status && response.status.match(/200/))) {
                this.credentials.status.ttl = Date.now() + 895000 // ~15 min
                this.credentials.status.token = response.token
                this.credentials.status.auth_as = this.credentials.username
                this.credentials.userinfo = response.data
                return {
                    token: response.token,
                    userinfo: response.data
                }
            }

            this.credentials.status = this.credentials.userinfo = Object()
            throw Error(response.status || 'LogIn unknown error')
        })
    }

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
    search(info) {
        let subs = Array()

        return this.login()
            .then(() => libsearch.optimizeQueryTerms(info))
            .then(optimizedQT => {
                return Promise.all(optimizedQT.map(op => {
                    return this.api.SearchSubtitles(this.credentials.status.token, [op]).then(result => subs = subs.concat(result.data))
                }))
            })
            .then(() => libsearch.optimizeSubs(subs, info))
            .then(list => libsearch.filter(list, info))
    }

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
    upload(subtitle) {
        return new Promise((resolve, reject) => {
            let persistent_data = Object()

            this.login()
                .then(() => libupload.createTryData(subtitle))
                .then(tryArray => {
                    persistent_data = tryArray.cd1
                    return this.api.TryUploadSubtitles(this.credentials.status.token, tryArray)
                })
                .then(response => {
                    if (response.alreadyindb === 1) {
                        resolve(response) // it exists, don't go further
                    } else {
                        persistent_data.subpath = subtitle.subpath // inject subpath
                        return libupload.parseResponse(response, persistent_data)
                    }
                })
                .then(libupload.createContent)
                .then(libupload.arrangeUploadData)
                .then(uploadArray => this.api.UploadSubtitles(this.credentials.status.token, uploadArray))
                .then(response => {
                    if (response.data === String() || !response.status.match(/200/)) throw Error(response.status || 'UploadSubtitles unknown error')
                    resolve(response)
                }).catch(reject)
        })
    }

    /**
     * Extract Movie Hash & Movie Bytes Size from a video
     * @param {String}          path - Mandatory, absolute path to a video file
     */
    hash(path) {
        if (!path) throw Error('Missing path')
        return libhash.computeHash(path)
    }

    /**
     * Movie identification service, get imdb information, send moviehashes
     * @param {Object}
     *
     * @param {String}          path - Mandatory, absolute path to a video file
     * @param {String}          imdb - Optionnal, matching imdb id
     * @param {Boolean}         extend - Optionnal, fetches metadata from OpenSubtitles
     */
    identify(query) {
        if (!query && !query.path) throw Error('Missing path')
        if (!query.path) query = {path: query}

        return this.login()
            .then(() => this.hash(query.path))
            .then(info => {
                query.moviehash = info.moviehash
                query.moviebytesize = info.moviebytesize
                return this.api.CheckMovieHash(this.credentials.status.token, [query.moviehash])
            })
            .then(response => {
                if (response.data === String() || !response.status.match(/200/)) throw Error(response.status || 'OpenSubtitles unknown error')

                const id = query.imdb || libid.readNFO(query.path)
                if (response.data[query.moviehash].length === 0 && id) {
                    return this.api.InsertMovieHash(this.credentials.status.token, [{
                        moviehash: query.moviehash,
                        moviebytesize: query.moviebytesize,
                        imdbid: id.replace('tt', ''),
                        moviefilename: require('path').basename(query.path)
                    }])
                } else {
                    return response
                }
            })
            .then(response => libid.parseResponse(response, query))
            .then(data => {
                if (data.metadata && data.metadata.imdbid && query.extend) {
                    return this.api.GetIMDBMovieDetails(this.credentials.status.token, data.metadata.imdbid.replace('tt', '')).then(ext => libid.extend(data, ext))
                } else {
                    return data
                }
            })
    }

    /**
     * Extract md5 hash from a subtitle file
     * @param {String}          path - Mandatory, absolute path to a subtitle file
     */
    md5(path) {
        if (!path) throw Error('Missing path')
        return libhash.computeMD5(path)
    }
}
