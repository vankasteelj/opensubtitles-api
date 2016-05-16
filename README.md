# opensubtitles-api

**[OpenSubtitles.org](http://www.opensubtitles.org/) api wrapper for downloading and uploading subtitles, written in NodeJS.**

Based on Promises and thus working asynchronously (thanks to Bluebird), this module uses XML-RPC (thanks to xmlrpc) to communicate with [OpenSubtitles](http://www.opensubtitles.org/) using Node.js

In addition of allowing to use all available methodCalls asynchronously, it also allows you to directly use powerfull custom calls, like: 

- `search`: Chained function returning the best matching subtitles based on the information you can feed it.
- `upload`: Chained function requiring only the path to the video and to the subtitle files to send new subtitles to OpenSubtitles.org (flow: LogIn > TryUploadSubtitles > UploadSubtitles)
- `extractInfo`: Function returning Hash and Byte size for a given video
- `computeMD5`: Function returning Hash for a given subtitle
- `identify`: Chained function returning metadata based on video file hash

*Read index.js for more info on the custom calls*

*More complete [docs](http://trac.opensubtitles.org/projects/opensubtitles) are available.*
*This module requires a [valid UserAgent](http://trac.opensubtitles.org/projects/opensubtitles/wiki/DevReadFirst).*

------

## Quick start

    npm install opensubtitles-api

Then:

```js
var OS = require('opensubtitles-api');
var OpenSubtitles = new OS({
    useragent:'UserAgent',
    username: 'Username',
    password: 'Password',
    ssl: true
});
```

*You can omit username and password to use OpenSubtitles.org anonymously (not all methods are available)*

*You can omit the endpoint to use HTTP default OpenSubtitles API endpoint: http://api.opensubtitles.org:80/xml-rpc*

*SSL: default value is 'false', set to true to use https. This parameter gets overwritten by any custom endpoint*

*NOTE: 'Password' can be a MD5 encrypted string, OpenSubtitles accept these. It is recommended to use it. You can get the MD5 of a PASSWORD string by doing: `require('crypto').createHash('md5').update(PASSWORD).digest('hex');`*

------

## Examples:

### A simple login:

```js
OpenSubtitles.login()
    .then(function(token){
        console.log(token);
    })
    .catch(function(err){
        console.log(err);
    });
```

If successful, will return:

```js
token = "8qnesekc42g8kj1d58i6fonm61"
```

*NOTE: The `login()` call is useful to verify "Username" and "Password" (if you get a token, you're authentified, as simple as that), but is never needed for the custom calls (search, upload), they're made by the module itself. If you use raw xml-rpc call (OpenSubtitles.api.methodCall), prefer to login with the raw `OpenSubtitles.api.LogIn`*

------

### Get in touch with OpenSubtitles.org API directly:

```js
var OS = require('opensubtitles-api');
var OpenSubtitles = new OS('UserAgent');

OpenSubtitles.api.LogIn('username', 'password', 'en', 'UserAgent')
    .then( // do stuff...
```

Methods available through the extended `OpenSubtitles.api.<method>`call:
- LogIn
- LogOut
- SearchSubtitles
- SearchToMail
- CheckSubHash
- CheckMovieHash
- CheckMovieHash2
- InsertMovieHash
- TryUploadSubtitles
- UploadSubtitles
- DetectLanguage
- DownloadSubtitles
- ReportWrongMovieHash
- ReportWrongImdbMovie
- GetSubLanguages
- GetAvailableTranslations
- GetTranslation
- GetUserInfo
- SearchMovieOnIMDB
- GetIMDBMovieDetails
- GuessMovieFromString
- InsertMovie
- SubtitlesVote
- GetComments
- AddComment
- AddRequest
- SetSubscribeUrl
- SubscribeToHash
- AutoUpdate
- SuggestMovie
- NoOperation
- ServerInfo

*NOTE: [All methods](http://trac.opensubtitles.org/projects/opensubtitles/wiki/XmlRpcIntro#XML-RPCmethods) should be supported. You can consult `./lib/opensubtitles.js` for the list of available calls and the required parameters.*

------

### Search the best subtitles in all languages for a given movie/episode:

```js
OpenSubtitles.search({
    sublanguageid: 'fre',       // Can be an array.join, 'all', or be omitted.
    hash: '8e245d9679d31e12',   // Size + 64bit checksum of the first and last 64k
    filesize: '129994823',      // Total size, in bytes.
    path: 'foo/bar.mp4',        // Complete path to the video file, it allows
                                //   to automatically calculate 'hash'.
    filename: 'bar.mp4',        // The video file name. Better if extension
                                //   is included.
    season: '2',
    episode: '3',
    extensions: ['srt', 'vtt'], // Accepted extensions, defaults to 'srt'.
    limit: '3',                 // Can be 'best', 'all' or an
                                // arbitrary nb. Defaults to 'best'
    imdbid: '528809',           // 'tt528809' is fine too.
    fps: '23.96',               // Number of frames per sec in the video.
    query: 'Charlie Chaplin',   // Text-based query, this is not recommended.
    gzip: true                  // returns url to gzipped subtitles, defaults to false
}).then(function (subtitles) {
    // an array of objects, no duplicates (ordered by
    // matching + uploader, with total downloads as fallback)
});
```

Example output:

```js
Object {
    en: {
        downloads: "432",
        encoding: "ASCII",
        id: "192883746",
        lang: "en",
        langName: "English",
        score: 9,
        url: "http://dl.opensubtitles.org/download/subtitle_file_id.srt"
    }
    fr: {
        download: "221",
        encoding: "UTF-8",
        id: "1992536558",
        lang: "fr",
        langName: "French",
        score: 6,
        url: "http://dl.opensubtitles.org/download/subtitle_file_id.srt"
    }
}
```

*NOTE: No parameter is mandatory, but at least one is required. The more possibilities you add, the best is your chance to get the best matching subtitles in a large variation of languages.*
*I don't recommend ever using "query", as it is highly error-prone.*
*sublangageid is a [3 letters langcode](http://www.loc.gov/standards/iso639-2/php/code_list.php) (ISO 639-2 based)

Here's how the function prioritize:
1. Hash + filesize (or Path, that will be used to calculate hash and filesize)
2. Filename
3. IMDBid (+ Season and Episode for TV Series)

The function internally ranks the subtitles to get the best match given the info you provided. It works like this:

```
matched by 'hash' and uploaded by:
    + admin|trusted     12
    + platinum|gold     11
    + user|anon         8

matched by tag and uploaded by:
    + admin|trusted     11
    + platinum|gold     10
    + user|anon         7

matched by imdb and uploaded by:
    + admin|trusted     9
    + platinum|gold     8
    + user|anon         5

matched by other and uploaded by:
    + admin|trusted     4
    + platinum|gold     3
    + user|anon         0

bonus of fps matching if:
    + nothing matches   2
    + imdb matches      0.5
```

------

### Upload a subtitle:

```js
OpenSubtitles.upload({
        path: '/home/user/video.avi',       // path to video file
        subpath: '/home/user/video.srt'     // path to subtitle
    })
    .then(function(response){
        console.log(response);
    })
    .catch(function(err){
        console.log(err);
    });
```

Example output (if successfully uploaded):

```js
Object {
    status: '200 OK'
    data: 'http://www.opensubtitles.org/subtitles/123456' //absolute link to subtitles
    seconds: '1.171'
}
```

*NOTE: Only `subpath` is mandatory. However, it is **highly recommended** to also provide `path` and `imdbid` to make sure you can add a subtitle even if the movie isn't already in the database.*

Optionnal parameters are self-explanatory:

- sublanguageid         // subtitle is in which language?
- highdefinition        // is for HD versions
- hearingimpaired       // subtitle contains written description of sounds
- moviereleasename      // title of the release, usually the filename without extension
- movieaka              // alternate title, for example in another language
- moviefps              // frames par second
- movieframes           // total number of frames in the video
- movietimems           // total duration in milliseconds
- automatictranslation  // the subtitle was translated by a machine, eg. Google Translate
- subauthorcomment      // commentary from the author
- subtranslator         // subtitle was translated by?
- foreignpartsonly      // subtitle only contains translation for non-native language, example: only the elvish and Ork in 'The Lord of the Ring', not the english.

------

### Use gzipped subtitles:
Using gzipped subtitles can reduce load on opensubtitles and enhance everyone's experience.

Example: download the best matching subtitle in french, unzip it and display the subtitle.

```js
var OpenSubtitles = require('opensubtitles-api');
var OS = new OpenSubtitles('OSTestUserAgent');
OS.search({
    imdbid: 'tt0314979',
    sublanguageid: 'fre',
    gzip: true
}).then(function (subtitles) {
    if (subtitles.fr) {
        console.log('Subtitle found:', subtitles);
        var subtitle_url = subtitles.fr.url.replace('.srt','.gz');
        require('request')({
            url: subtitle_url,
            encoding: null
        }, function (error, response, data) {
            if (error) throw error;
            require('zlib').unzip(data, function (error, buffer) {
                if (error) throw error;
                var subtitle_content = buffer.toString(subtitles.fr.encoding);
                console.log('Subtitle content:', subtitle_content);
            });
        });
    } else {
        throw 'no subtitle found';
    }
}).catch(function (error) {
    console.error(error);
});
```


------

### Extract Hash & MovieByteSize

```js
OpenSubtitles.extractInfo('path/to/file.mp4')
    .then(function (infos) {
        console.log(infos);
    });
```

Example output: 

```js
Object {
    moviehash: 'b6e2dab8fc092977'
    moviebytesize: '424954701'
}
```

------

### Get metadata from Hash

```js
OpenSubtitles.identify({
        path: 'C:\video\file.mp4',
        extended: true
    })
    .then(function (data) {
        console.log(data);
    });
```

Example output:

```js
Object {
    added: false
    metadata: Object {
        cast: Object {}
        country: Array[1]
        cover: "http://link-to-image/pic.jpg"
        directors: Object {}
        duration: "82 min"
        genres: Array[4]
        imdbid: "tt0997518"
        rating: "6.5"
        synopsys: "This is the story about a man sitting in his appartment"
        title: "Potiche"
        year: "2006"
    }
    moviebytesize: "518064188"
    moviehash: "a91cf276aaa6bf20"
    subcount: "38"
    type: "movie"
}
```

------

### Extra notes:
If you're logging in anonymously by default and wanna update the module with a username/password for the future, just throw in a new `new OpenSubtitle({})` with the right object. Same thing to switch endpoint or http/https.

------


## License

This code is registered under GPLv3

### The GNU GENERAL PUBLIC LICENSE (GPL)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see http://www.gnu.org/licenses/