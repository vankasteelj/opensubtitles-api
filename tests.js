// what broke? 

const OS = require('opensubtitles-api')
const options = {
  api_key: '', 
  debug: true,
  username: '',
  password: ''
}

const os = new OS(options)

return new Promise((resolve, reject) => {
  console.log('Testing GET /discover/latest')
  return os.discover.latest()
}).then(response => {
  console.log('Response', response)
  console.log('Testing POST /login')
  return os.login({
    username: options.username,
    password: options.password
  })
}).then(response =>  {
  console.log('Logged in, got token %s', response.token)
  console.log('Testing DELETE /logout')
  return os.logout()
}).then(response => {
  console.log('Logged out. Session destroyed.')
  console.log('Test done')
  return resolve()
}).catch(error => {
  console.error(error)
  return reject(error)
})