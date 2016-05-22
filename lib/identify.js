var libhash = require('./hash.js'),
    path = require('path'),
    fs = require('fs'),
    _ = require('lodash'),
    Promise = require('bluebird');

var LibID = function() {};

LibID.prototype.readNFO = function(file) {
    var p = path.parse(file),
        nfo = path.join(p.dir, p.name + '.nfo'),
        detected_id, exist;

    if (fs.existsSync(nfo)) {
        exist = fs.readFileSync(nfo).toString().match(/tt\d+/i);
        detected_id = exist ? exist[0] : undefined;
    } else {
        var files = fs.readdirSync(p.dir);
        _.each(files, function(f) {
            if (f.match(/\.nfo/i) !== null) {
                exist = fs.readFileSync(path.join(p.dir, f)).toString().match(/tt\d+/i);
                detected_id = exist ? exist[0] : undefined;
                return;
            }
        });
    }
    return detected_id;
};


LibID.prototype.parseResponse = function(response, info) {
    if (response.data !== '' && response.status.match(/200/)) {

        if (response.data[info.moviehash] && response.data[info.moviehash].length !== 0) { // we got valid info
            data = {
                subcount: response.data[info.moviehash].SubCount,
                added: response.data.accepted_moviehashes ? true : false,
                metadata: {
                    imdbid: response.data[info.moviehash].MovieImdbID !== '0' ? 'tt' + response.data[info.moviehash].MovieImdbID : undefined,
                    title: response.data[info.moviehash].MovieName,
                    year: response.data[info.moviehash].MovieYear,
                }
            };
            if (response.data[info.moviehash].SeriesEpisode + response.data[info.moviehash].SeriesSeason !== '00') {
                data.metadata.episode = response.data[info.moviehash].SeriesEpisode;
                data.metadata.season = response.data[info.moviehash].SeriesSeason;
                data.metadata.episode_title = data.metadata.title.split('"')[2].trim();
                data.metadata.title = data.metadata.title.split('"')[1].trim();
            }

        } else if (response.data.accepted_moviehashes && response.data.accepted_moviehashes.length !== 0) { // we pushed new hash
            data = {
                added: true
            };

        } else { // this was a waste of time
            data = {
                added: false
            };
        }

        data.moviehash = info.moviehash; // inject moviehash
        data.moviebytesize = info.moviebytesize; // inject moviebytesize

        if (info.imdb && !data.metadata) { // inject imdb if possible
            data.metadata = {
                imdbid: 'tt' + info.imdb.replace('tt', '')
            };
        }

        return data;

    } else {
        throw new Error(response.status || 'OpenSubtitles unknown error');
    }
};

LibID.prototype.extend = function(data, response) {
    if (response.data !== '' && response.status.match(/200/)) {
        if (response.data.kind.match(/episode/i)) {
            data.type = 'episode';
        } else if (response.data.kind.match(/movie/i)) {
            data.type = 'movie';
        } else {
            delete data.metadata;
            return data; // it's impossible to identify a file as an entire show
        }

        data.metadata.cast = response.data.cast ? response.data.cast : {};
        data.metadata.country = response.data.country ? response.data.country : [];
        data.metadata.cover = response.data.cover;
        data.metadata.directors = response.data.directors ? response.data.directors : {};
        data.metadata.duration = response.data.duration;
        data.metadata.genres = response.data.genres ? response.data.genres : [];
        data.metadata.rating = response.data.rating;
        data.metadata.synopsis = response.data.plot && response.data.plot.match(/add a plot/i) !== null ? undefined : response.data.plot;
        data.metadata.year = response.data.year;
        data.metadata.trivia = response.data.trivia ? response.data.trivia.replace('See more >>', '').trim() : undefined;
        data.metadata.goofs = response.data.goofs;
        data.metadata.votes = response.data.votes;
        data.metadata.language = response.data.language ? response.data.language : [];
        data.metadata.aka = response.data.aka ? response.data.aka : [];
        data.metadata.awards = response.data.awards ? response.data.awards : [];
        data.metadata.tagline = response.data.tagline;

        if (data.type === 'episode' && response.data.episodeof) {
            data.metadata.show_imdbid = Object.keys(response.data.episodeof).length > 0 ? Object.keys(response.data.episodeof)[0].replace('_','tt') : undefined;
        }
    }
    return data;
};

module.exports = new LibID();