const OS = require('./index.js')
const UA = 'OSTestUserAgentTemp'
let os, test
const testSearch = 0
const searchs = [
    // 0 imdb 
    { imdbid: '0898266', show: 'The Big Bang Theory', season: '01', episode: '01', limit: 'all' },
    // 1 imdb + filename (typical popcorn-time query)
    { imdbid: '0898266', season: '01', episode: '01', filename: 'The.Big.Bang.Theory.S01E01.HDTV.XviD-XOR.mkv', limit: 'all' },
    // 2 tag 
    { filename: 'The Big Bang Theory S01E01.mkv', limit: 'all' },
    // 3 hash (put a real path)
    { path: "D:/TvShows/The Big Bang Theory/Season 1/The Big Bang Theory S01E01.mkv", limit: 'all' },
    // 4 hash + imdb (put a real path)
    { path: "D:/TvShows/The Big Bang Theory/Season 1/The Big Bang Theory S01E01.mkv", imdbid: '0898266', season: '01', episode: '01', limit: 'all' },
]

test = 'http client'
os = new OS({
    useragent: UA,
    ssl: false
})
console.time(test)
os.api.ServerInfo().then(() => {
    console.timeEnd(test)

    test = 'https client'
    os = new OS({
        useragent: UA,
        ssl: true
    })
    console.time(test)
    return os.api.ServerInfo()
}).then(() => {
    console.timeEnd(test)

    test = 'search'
    console.time(test)
    //return seachs.map(os.search)

    return os.search(searchs[testSearch])
}).then(() => {
    console.timeEnd(test)
    console.log('Passed test.')
}).catch((err) => {
    console.log('Test failed')
    console.log(err)
})