'use strict'

// requirejs modules
const got = require('got')
const methods = require('./methods.json')
const pkg = require('./package.json');

// default settings
const defaultUrl = 'https://www.opensubtitles.com'
const defaultUa = `${pkg.name}/${pkg.version} (NodeJS; +${pkg.repository.url})`

// wrapper
module.exports = class OpenSubtitles {
  constructor(settings = {}) {
    this._settings = {
      endpoint: settings.api_url || defaultUrl,
      debug: settings.debug || false,
      useragent: settings.useragent || defaultUa
    }

    this._construct()
  }

  // Creates methods for all requests
  _construct() {
    for (let url in methods) {
      const urlParts = url.split('/')
      const name = urlParts.pop() // key for function

      let tmp = this
      for (let p = 1; p < urlParts.length; ++p) { // acts like mkdir -p
        tmp = tmp[urlParts[p]] || (tmp[urlParts[p]] = {})
      }

      tmp[name] = (() => {
        const method = methods[url] // closure forces copy
        return (params) => {
            return this._call(method, params)
        }
      })()
    }

    this._debug(`Opensubtitles-api: module loaded, as ${this._settings.useragent}`)
  }

  // Debug & Print
  _debug(req) {
    this._settings.debug && console.log(req.method ? `${req.method}: ${req.url}` : req);
  }

  login() {}
}