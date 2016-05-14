var libhash = require('./hash.js'),
    path = require('path'),
    Promise = require('bluebird');

var LibUpload = function() {};

// Create a valid object from passed info for TryUploadSubtitles
LibUpload.prototype.createTryData = function(input) {

    var checkMovie = function() {
        return new Promise(function(resolve, reject) {
            var tmpObj = {};

            if (!input.path) {
                return resolve(tmpObj);
            }

            libhash.computeHash(input.path)
                .then(function(response) {
                    tmpObj = response; // moviebytesize + moviehash
                    tmpObj.moviefilename = path.basename(input.path);
                    resolve(tmpObj);
                })
                .catch(reject);
        });
    };

    var checkSub = function(previousObj) {
        return new Promise(function(resolve, reject) {
            var tmpObj = previousObj;

            if (!input.subpath) {
                throw new Error('Missing subpath parameter (path to subtitle file)');
            }

            libhash.computeMD5(input.subpath)
                .then(function(md5) {
                    tmpObj.subhash = md5;
                    tmpObj.subfilename = path.basename(input.subpath);
                    resolve(tmpObj);
                })
                .catch(reject);
        });
    };

    var injectInput = function(previousObj) {
        var tmpObj = previousObj;

        if (input.imdbid) tmpObj.idmovieimdb = input.imdbid.toString().replace('tt', '');
        if (input.sublanguageid) tmpObj.sublanguageid = input.sublanguageid;
        if (input.moviefps) tmpObj.moviefps = input.moviefps.toString();
        if (input.movieframes) tmpObj.movieframes = input.movieframes.toString();
        if (input.movietimems) tmpObj.movietimems = input.movietimems.toString();
        if (input.subauthorcomment) tmpObj.subauthorcomment = input.subauthorcomment;
        if (input.subtranslator) tmpObj.subtranslator = input.subtranslator;
        if (input.moviereleasename) tmpObj.moviereleasename = input.moviereleasename;
        if (input.movieaka) tmpObj.movieaka = input.movieaka;
        if (input.hearingimpaired) tmpObj.hearingimpaired = isNaN(parseInt(input.hearingimpaired)) ? input.hearingimpaired ? '1' : '0' : input.hearingimpaired.toString();
        if (input.highdefinition) tmpObj.highdefinition = isNaN(parseInt(input.highdefinition)) ? input.highdefinition ? '1' : '0' : input.highdefinition.toString();
        if (input.automatictranslation) tmpObj.automatictranslation = isNaN(parseInt(input.automatictranslation)) ? input.automatictranslation ? '1' : '0' : input.automatictranslation.toString();
        if (input.foreignpartsonly) tmpObj.foreignpartsonly = isNaN(parseInt(input.foreignpartsonly)) ? input.foreignpartsonly ? '1' : '0' : input.foreignpartsonly.toString();

        return tmpObj;
    };

    // mandatory: subhash (md5 of subtitles), subfilename, moviehash, moviebytesize, moviefilename
    return new Promise(function(resolve, reject) {
        checkMovie()
            .then(checkSub)
            .then(injectInput)
            .then(function(data) {
                var arr = {};
                arr.cd1 = data;
                return arr;
            })
            .then(resolve)
            .catch(reject)
    });
};

// Create a valid object for Upload
LibUpload.prototype.arrangeUploadData = function(input) {

    var baseinfo = {
        idmovieimdb: input.idmovieimdb.toString()
    };

    if (input.sublanguageid) baseinfo.sublanguageid = input.sublanguageid;
    if (input.automatictranslation) baseinfo.automatictranslation = input.automatictranslation;
    if (input.subauthorcomment) baseinfo.subauthorcomment = input.subauthorcomment;
    if (input.subtranslator) baseinfo.subtranslator = input.subtranslator;
    if (input.highdefinition) baseinfo.highdefinition = input.highdefinition;
    if (input.releasename) baseinfo.moviereleasename = input.releasename;
    if (input.aka) baseinfo.movieaka = input.movieaka;
    if (input.hearingimpaired) baseinfo.hearingimpaired = input.hearingimpaired;

    var cd1 = {
        subhash: input.subhash,
        subfilename: input.subfilename,
        moviefilename: input.moviefilename,
        moviehash: input.moviehash,
        moviebytesize: input.moviebytesize.toString(),
        subcontent: input.subcontent
    };

    if (input.moviefps) cd1.moviefps = input.moviefps;
    if (input.movieframes) cd1.movieframes = input.movieframes.toString();
    if (input.movietimems) cd1.movietimems = input.movietimems.toString();

    return {
        baseinfo: baseinfo,
        cd1: cd1
    };
};

// Read subfile content
LibUpload.prototype.createContent = function(input) {
    return new Promise(function(resolve, reject) {
        libhash.computeSubContent(input.subpath)
            .then(function(base64) {
                delete input.subpath;
                input.subcontent = base64;
                resolve(input);
            })
            .catch(reject)
    });
};

// Analyze TryUploadSubtitles response and behave in function
LibUpload.prototype.parseResponse = function(response, input) {
    if (response.data && response.data[0]) { // response
        if (response.data[0].IDMovieImdb) { // response & response.imdb
            input.idmovieimdb = response.data[0].IDMovieImdb;
            return input;
        } else { // response & no reponse.imdb
            if (input.idmovieimdb) { // response & no response.imdb but input.imdb
                return input;
            } else { // response & no response.imdb & no input.imdb
                throw new Error('Matching IMDB ID cannot be found');
            }
        }
    } else { // no response
        if (input.idmovieimdb) { // no response but input.imdb
            return input;
        } else { // no response & no input.imdb
            throw new Error('Matching IMDB ID cannot be found');
        }
    }
};

module.exports = new LibUpload();