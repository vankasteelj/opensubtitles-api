// what broke? 
'use strict'

const imdb_id = 'tt0120737' // the lord of the rings

const OSApi = require('./opensubtitles.js')
const options = {
  api_key: '', 
  debug: true,
  username: '',
  password: ''
}

const osapi = new OSApi(options)

console.log('Testing opensubtitles-api module structure')
console.log(osapi)

console.log('Testing GET /discover/latest')
return osapi.discover.latest().then(response => {
  console.log('Got response', response)
  console.log('Testing POST /login')
  return osapi.login({
    username: options.username,
    password: options.password
  })
}).then(response =>  {
  console.log('Logged in, got token %s', response.token)
  console.log('The token is stored', osapi._authentication)
  console.log('Testing GET /subtitle')
  return osapi.subtitles({
    imdb_id: imdb_id
  })
}).then(response => {
  console.log('Got response', response)
  console.log('Grabbing the first result to download', response.data[0])
  console.log('Testing POST /download')
  return osapi.download({
    file_id: response.data[0].id
  })
}).then(response => {
  console.log('Got response', response)
  console.log('Testing DELETE /logout')
  return osapi.logout()
}).then(response => {
  console.log('Logged out. Session destroyed.')
  console.log('Test done')
}).catch(error => console.error(error))