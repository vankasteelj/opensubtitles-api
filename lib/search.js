const OS = require('./opensubtitles.js')
const libhash = require('./hash.js')
const path = require('path')

module.exports = new class LibSearch {

    checkHash(input) {
        return new Promise((resolve, reject) => {
            if (!input.hash && !input.path) return resolve(false)

            if (!input.hash && input.path) return libhash.computeHash(input.path).then(resolve).catch(reject)

            const tmpObj = { moviehash: input.hash }
            if (input.filesize) tmpObj.moviebytesize = input.filesize.toString()
            resolve(tmpObj)
        })
    }

    optimizeQueryTerms(input) {
        return this.checkHash(input).then(obj => {
            const output = Array()
            let i = 0

            if (obj) { // first data call
                output[i] = obj
                i++
            }

            if (input.filename || input.path) { // second data call
                output[i] = Object()
                output[i].tag = input.filename || path.basename(input.path)
                i++
            }

            if (input.imdbid) { // third data call
                output[i] = Object()
                output[i].imdbid = input.imdbid.toString().replace('tt', '')

                if (input.season && input.episode) {
                    output[i].season = parseInt(input.season).toString()
                    output[i].episode = parseInt(input.episode).toString()
                }
                i++
            }

            if (!input.imdbid && !input.hash && !input.path && !input.filename && input.query) { // fallback
                output[i] = Object()
                output[i].query = input.query

                if (input.season && input.episode) {
                    output[i].season = parseInt(input.season).toString()
                    output[i].episode = parseInt(input.episode).toString()
                }
                i++
            }

            // mandatory lang parameter
            for (let o of output) {
                o.sublanguageid = input.sublanguageid || 'all'
            }

            return output
        })
    }

    normalizeProt() {
        const from = 'ÃÀÁÄÂÈÉËÊÌÍÏÎÒÓÖÔÙÚÜÛãàáäâèéëêìíïîòóöôùúüûÑñÇç'
        const to = 'AAAAAEEEEIIIIOOOOUUUUaaaaaeeeeiiiioooouuuunncc'
        const mapping = Object()

        for (let i = 0, j = from.length; i < j; i++) {
            mapping[from.charAt(i)] = to.charAt(i)
        }

        return str => {
            const ret = Array()
            for (let i = 0, j = str.length; i < j; i++) {
                let c = str.charAt(i)
                ret.push(mapping[c] || c)
            }
            return ret.join('')
        }
    }

    optimizeSubs(response, input) {
        // based on OpenSRTJS, under MIT - Copyright (c) 2014 Eóin Martin

        let fileTags
        let fileTagsDic = Object()
        const normalize = this.normalizeProt()
        const matchTags = (sub, maxScore) => {
            if (!input.filename) return 0

            if (!fileTags) fileTags = normalize(input.filename).toLowerCase().match(/[a-z0-9]{2,}/gi)
            if (!fileTags.length) return 0

            const subNames = normalize(sub.MovieReleaseName + '_' + sub.SubFileName)
            const subTags = subNames.toLowerCase().match(/[a-z0-9]{2,}/gi)

            if (!subTags.length) return 0

            for (let tag of fileTags) fileTagsDic[tag] = false

            let matches = 0
            for (let subTag of subTags) { // is term in filename, only once
                if (!fileTagsDic[subTag]) {
                    fileTagsDic[subTag] = true
                    matches++
                }
            }

            return parseInt((matches / fileTags.length) * maxScore)
        }

        const subtitles = Object()

        // if string passed as supported extension, convert to array
        if (input.extensions && typeof input.extensions === 'string') input.extensions = [input.extensions]

        // if no supported extensions passed, default to 'srt'
        if (!input.extensions || !input.extensions instanceof Array) input.extensions = ['srt']

        return Promise.all(response.map(sub => {
            if (!sub || input.extensions.indexOf(sub.SubFormat) == -1) return

            // imdbid check
            if (input.imdbid) {
                let tmpId = parseInt(input.imdbid.toString().replace('tt', ''), 10)

                if (sub.SeriesIMDBParent && sub.SeriesIMDBParent.toString() !== '0') {
                    if (parseInt(sub.SeriesIMDBParent, 10) !== tmpId) return // tv episode
                } else {
                    if (sub.IDMovieImdb && parseInt(sub.IDMovieImdb, 10) !== tmpId) return // movie
                }
            }

            // episode check
            if (input.season && input.episode && (sub.SeriesSeason !== parseInt(input.season).toString() || sub.SeriesEpisode !== parseInt(input.episode).toString())) return

            const tmp = {
                url: input.gzip ? sub.SubDownloadLink : sub.SubDownloadLink.replace('.gz', ''),
                langcode: sub.ISO639,
                downloads: sub.SubDownloadsCnt,
                lang: sub.LanguageName,
                encoding: sub.SubEncoding,
                id: sub.IDSubtitleFile,
                filename: sub.SubFileName,
                score: 0
            }


            // score calculations
            sub.MatchedBy === 'moviehash' && (tmp.score += 8)
            sub.MatchedBy === 'tag' && (tmp.score += 7) || (tmp.score += matchTags(sub, 7))

            let matchByFPS = sub.MovieFPS && input.fps && parseInt(sub.MovieFPS) > 0 && (sub.MovieFPS.startsWith(input.fps) || input.fps.toString().startsWith(sub.MovieFPS))
            sub.MatchedBy === 'imdbid' && (tmp.score += 5) && matchByFPS && (tmp.score += 0.5)
            !sub.MatchedBy.match(/moviehash|tag|imdbid/) && matchByFPS && (tmp.score += 2)

            sub.UserRank.match(/trusted|administrator/) && (tmp.score += 4)
            sub.UserRank.match(/platinum member|gold member/) && (tmp.score += 3)

            // store subs for sorting
            if (!subtitles[tmp.langcode]) {
                subtitles[tmp.langcode] = [tmp]
            } else {
                subtitles[tmp.langcode][Object.keys(subtitles[tmp.langcode]).length] = tmp
            }

            return
        })).then(() => subtitles)
    }

    filter(list = Object(), input) {
        const subtitles = Object()

        if (!input.limit || (isNaN(input.limit) && ['best', 'all'].indexOf(input.limit.toLowerCase()) == -1)) {
            input.limit = 'best'
        }

        for (let i in list) {
            let lang = list[i]
            let langcode = lang[0].langcode

            // sort by score, sub-sort by downloads
            lang = lang.sort((a, b) => {
                if (a.score === b.score) {
                    let x = a.downloads
                    let y = b.downloads
                    return y < x ? -1 : y > x ? 1 : 0
                }
                return b.score - a.score
            })

            // filter
            switch (input.limit.toString().toLowerCase()) {
                case 'best':
                    // keep only the first (best) item
                    subtitles[langcode] = lang[0]
                    break
                case 'all':
                    // all good already
                    subtitles[langcode] = lang
                    break
                default:
                    // keep only n = input.limit items
                    subtitles[langcode] = lang.slice(0, parseInt(input.limit))
            }
        }

        return Promise.resolve(subtitles)
    }
}