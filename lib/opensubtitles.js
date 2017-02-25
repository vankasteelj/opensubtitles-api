const xmlrpc = require('xmlrpc')
const URIjs = require('urijs')

const pjson = require('../package.json')
const url = 'http://api.opensubtitles.org:80/xml-rpc'
const url_ssl = 'https://api.opensubtitles.org:443/xml-rpc'

module.exports = class OS {
    constructor(endpoint, ssl) {
        const UA = pjson.name + ' v' + pjson.version
        const uri = endpoint || (ssl ? url_ssl : url)
        const req = URIjs(uri)._parts
        const secure = req.protocol === 'https'

        const opts = {
            host: req.hostname,
            port: req.port || (secure ? 443 : 80),
            path: req.path,
            headers: {
                'User-Agent': UA
            }
        }

        this.client = secure ? xmlrpc.createSecureClient(opts) : xmlrpc.createClient(opts)
    }

    handleError(error) {
        error.message && error.message.match('XML-RPC tag \'TITLE\'') && (error.message = 'API seems offline')
        return error
    }

    call(method, args) {
        return new Promise((resolve, reject) => {
            this.client.methodCall(method, [...args], (err, data) => {
                if (err) return reject(this.handleError(err))
                resolve(data)
            })
        })
    }

    LogIn(username, password, language, useragent) {
        return this.call('LogIn', arguments)
    }
    LogOut(token) {
        return this.call('LogOut', arguments)
    }
    SearchSubtitles(token, array_queries) {
        return this.call('SearchSubtitles', arguments)
    }
    SearchToMail(token, array_langs, array_movies) {
        return this.call('SearchToMail', arguments)
    }
    CheckSubHash(token, array_subs_hash) {
        return this.call('CheckSubHash', arguments)
    }
    CheckMovieHash(token, array_movies_hash) {
        return this.call('CheckMovieHash', arguments)
    }
    CheckMovieHash2(token, array_movies_hash) {
        return this.call('CheckMovieHash2', arguments)
    }
    InsertMovieHash(token, array_movies_info) {
        return this.call('InsertMovieHash', arguments)
    }
    TryUploadSubtitles(token, array_sub) {
        return this.call('TryUploadSubtitles', arguments)
    }
    UploadSubtitles(token, array_sub) {
        return this.call('UploadSubtitles', arguments)
    }
    DetectLanguage(token, array_texts) {
        return this.call('DetectLanguage', arguments)
    }
    DownloadSubtitles(token, array_subid) {
        return this.call('DownloadSubtitles', arguments)
    }
    ReportWrongMovieHash(token, IDSubMovieFile) {
        return this.call('ReportWrongMovieHash', arguments)
    }
    ReportWrongImdbMovie(token, array_movie) {
        return this.call('ReportWrongImdbMovie', arguments)
    }
    GetSubLanguages(language) {
        return this.call('GetSubLanguages', arguments)
    }
    GetAvailableTranslations(token, program) {
        return this.call('GetAvailableTranslations', arguments)
    }
    GetTranslation(token, iso639, format, program) {
        return this.call('GetTranslation', arguments)
    }
    GetUserInfo(token) {
        return this.call('GetUserInfo', arguments)
    }
    SearchMoviesOnIMDB(token, query) {
        return this.call('SearchMoviesOnIMDB', arguments)
    }
    GuessMovieFromString(token, array_titles) {
        // Beta - might break or stop working
        return this.call('GuessMovieFromString', arguments)
    }
    GetIMDBMovieDetails(token, imdbid) {
        return this.call('GetIMDBMovieDetails', arguments)
    }
    InsertMovie(token, array_movie) {
        return this.call('InsertMovie', arguments)
    }
    SubtitlesVote(token, array_vote) {
        return this.call('SubtitlesVote', arguments)
    }
    GetComments(token, array_subids) {
        return this.call('GetComments', arguments)
    }
    AddComment(token, array_comments) {
        return this.call('AddComment', arguments)
    }
    AddRequest(token, array_request) {
        return this.call('AddRequest', arguments)
    }
    SetSubscribeUrl(token, url) {
        return this.call('SetSubscribeUrl', arguments)
    }
    SubscribeToHash(token, array_hashs) {
        return this.call('SubscribeToHash', arguments)
    }
    AutoUpdate(program_name) {
        return this.call('AutoUpdate', arguments)
    }
    SuggestMovie(token, querystring) {
        return this.call('SuggestMovie', arguments)
    }
    QuickSuggest(token, str, sublanguageid) {
        return this.call('QuickSuggest', arguments)
    }
    NoOperation(token) {
        return this.call('NoOperation', arguments)
    }
    ServerInfo() {
        return this.call('ServerInfo', [])
    }
}